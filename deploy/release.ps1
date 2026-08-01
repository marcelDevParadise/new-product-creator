[CmdletBinding()]
param(
	[string]$Version,
	[string]$Message = "Release",
	[string]$Remote = "origin",
	[string]$PiHost = "marcel@100.87.118.91",
	[string]$PiRepoPath = "/home/marcel/new-product-creator",
	[int]$DeployTimeoutSeconds = 900,
	[switch]$SkipDeployWait
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
	param(
		[Parameter(Mandatory = $true, Position = 0)]
		[string]$GitCommand,
		[Parameter(Position = 1, ValueFromRemainingArguments = $true)]
		[string[]]$GitArguments
	)

	$allArguments = @($GitCommand) + @($GitArguments)
	$previousErrorActionPreference = $ErrorActionPreference
	$ErrorActionPreference = "Continue"
	try {
		$output = & git @allArguments 2>&1
		$gitExitCode = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previousErrorActionPreference
	}
	if ($gitExitCode -ne 0) {
		throw "git $($allArguments -join ' ') fehlgeschlagen:`n$($output -join "`n")"
	}
	return $output
}

function Get-NextDeployTag {
	$base = "deploy-" + (Get-Date -Format "yyyy-MM-dd")
	$highest = 0
	foreach ($existingTag in @(Invoke-Git tag -l "$base-*")) {
		if ($existingTag -match "^$([regex]::Escape($base))-(\d+)$") {
			$highest = [Math]::Max($highest, [int]$Matches[1])
		}
	}
	return "$base-$($highest + 1)"
}

function Invoke-SshCommand {
	param(
		[string]$HostName,
		[string]$Command
	)

	$previousErrorActionPreference = $ErrorActionPreference
	$ErrorActionPreference = "Continue"
	try {
		$output = @(
			& ssh `
				-o BatchMode=yes `
				-o ConnectTimeout=10 `
				-o ConnectionAttempts=1 `
				$HostName `
				$Command 2>&1
		)
		$sshExitCode = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previousErrorActionPreference
	}

	return [pscustomobject]@{
		ExitCode = $sshExitCode
		Output = $output
	}
}

function Wait-ForPiDeployment {
	param(
		[string]$Tag,
		[string]$HostName,
		[string]$RepoPath,
		[int]$TimeoutSeconds
	)

	if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
		throw "Tag wurde gepusht, aber SSH ist nicht verfuegbar. Pi-Deployment konnte nicht bestaetigt werden."
	}

	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
	$stateCommand = "test -f '$RepoPath/.last-deployed-tag' && cat '$RepoPath/.last-deployed-tag'"
	$healthCommand = "curl -fsS http://127.0.0.1:8000/api/health"
	$triggerCommand = "sudo -n systemctl start --no-block attribut-generator-update.service"

	Write-Host ""
	Write-Host "==> Warte auf Pi-Deployment von $Tag" -ForegroundColor Cyan
	$triggerResult = Invoke-SshCommand -HostName $HostName -Command $triggerCommand
	if ($triggerResult.ExitCode -eq 0) {
		Write-Host "    Pi-Updater wurde direkt gestartet." -ForegroundColor DarkGray
	} else {
		Write-Warning "Pi-Updater konnte nicht direkt gestartet werden. Warte auf den systemd-Timer."
	}

	$lastStatus = ""
	$nextStatusAt = Get-Date
	while ((Get-Date) -lt $deadline) {
		$stateResult = Invoke-SshCommand -HostName $HostName -Command $stateCommand
		$deployedTag = ""
		if ($stateResult.ExitCode -eq 0 -and $stateResult.Output.Count -gt 0) {
			$deployedTag = "$($stateResult.Output[0])".Trim()
		}

		if ($deployedTag -eq $Tag) {
			$healthResult = Invoke-SshCommand -HostName $HostName -Command $healthCommand
			if ($healthResult.ExitCode -eq 0 -and (($healthResult.Output -join "") -match '"status"\s*:\s*"ok"')) {
				Write-Host "Pi bestaetigt Tag '$Tag'; Backend-Healthcheck ist OK." -ForegroundColor Green
				return
			}
			$currentStatus = "Tag ist deployed; Backend-Healthcheck wartet"
		} elseif ($stateResult.ExitCode -ne 0) {
			$currentStatus = "Pi ist per SSH noch nicht erreichbar"
		} elseif ($deployedTag) {
			$currentStatus = "Pi meldet noch $deployedTag"
		} else {
			$currentStatus = "Pi hat noch keinen Deployment-Marker"
		}

		$now = Get-Date
		if ($currentStatus -ne $lastStatus -or $now -ge $nextStatusAt) {
			$remaining = [Math]::Max(0, [int]($deadline - $now).TotalSeconds)
			Write-Host "    $currentStatus; verbleibend: $remaining Sekunden" -ForegroundColor DarkGray
			$lastStatus = $currentStatus
			$nextStatusAt = $now.AddSeconds(30)
		}

		Start-Sleep -Seconds 10
	}

	throw "Tag '$Tag' wurde gepusht, aber das Pi-Deployment wurde innerhalb von $TimeoutSeconds Sekunden nicht bestaetigt."
}

$branch = "$(Invoke-Git rev-parse --abbrev-ref HEAD)".Trim()
if (-not $branch -or $branch -eq "HEAD") {
	throw "Release aus einem detached HEAD ist nicht erlaubt. Bitte zuerst einen Branch auschecken."
}
if ($branch -ne "master" -and $branch -ne "main") {
	Write-Warning "Du bist auf '$branch'. Tag wird auf dem letzten Commit dieses Branches erstellt."
}

$status = @(Invoke-Git status --porcelain)
if ($status.Count -gt 0) {
	throw "Working Tree ist nicht clean. Bitte erst committen oder stashen:`n$($status -join "`n")"
}

$trackedDatabases = @(Invoke-Git ls-files) | Where-Object {
	$_ -match '(?i)\.(db|sqlite|sqlite3|db3|sdb|s3db)(-wal|-shm)?$'
}
if ($trackedDatabases.Count -gt 0) {
	throw "Release abgebrochen: Datenbankdateien duerfen nicht von Git verwaltet werden:`n$($trackedDatabases -join "`n")"
}

Write-Host "==> Aktualisiere Remote- und Tag-Informationen" -ForegroundColor Cyan
Invoke-Git fetch $Remote --tags --prune | Out-Null

$upstream = "$(Invoke-Git rev-parse --abbrev-ref --symbolic-full-name '@{u}')".Trim()
$counts = "$(Invoke-Git rev-list --left-right --count "$upstream...HEAD")".Trim() -split '\s+'
$behind = [int]$counts[0]
$ahead = [int]$counts[1]
if ($behind -gt 0) {
	throw "Der Branch liegt $behind Commit(s) hinter $upstream. Bitte Aenderungen zuerst integrieren; der Ziel-Commit wurde nicht veraendert."
}

# Ab hier bleibt der Release-Commit unveraendert. Es gibt bewusst kein git pull.
$commit = "$(Invoke-Git rev-parse HEAD)".Trim()
$shortCommit = "$(Invoke-Git rev-parse --short=12 HEAD)".Trim()

if ($Version) {
	$tag = "v$($Version.TrimStart('v'))"
} else {
	$tag = Get-NextDeployTag
}

$localTag = @(Invoke-Git tag -l $tag)
$remoteTag = & git ls-remote --exit-code --tags $Remote "refs/tags/$tag" 2>$null
$remoteTagExitCode = $LASTEXITCODE
if ($remoteTagExitCode -ne 0 -and $remoteTagExitCode -ne 2) {
	throw "Remote '$Remote' konnte beim Pruefen des Tags '$tag' nicht zuverlaessig abgefragt werden."
}
if ($localTag.Count -gt 0 -or $remoteTagExitCode -eq 0) {
	throw "Tag '$tag' existiert bereits. Es wurde nichts veraendert."
}

Write-Host ""
Write-Host "==> Erstelle Release" -ForegroundColor Cyan
Write-Host "    Branch:       $branch"
Write-Host "    Commit:       $shortCommit"
Write-Host "    Tag:          $tag"
Write-Host "    Message:      $Message"
Write-Host "    Ahead:        $ahead Commit(s)"
Write-Host ""

Invoke-Git tag -a $tag $commit -m $Message | Out-Null

try {
	# Erst den Branch, danach ausschliesslich den gerade erstellten Tag pushen.
	Invoke-Git push $Remote $branch | Out-Null
	Invoke-Git push $Remote "refs/tags/$tag`:refs/tags/$tag" | Out-Null
} catch {
	Write-Warning "Der lokale Tag '$tag' bleibt zur Diagnose erhalten."
	throw
}

$peeledRemote = & git ls-remote $Remote "refs/tags/$tag^{}" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $peeledRemote) {
	throw "Tag '$tag' wurde gepusht, konnte danach aber nicht am Remote verifiziert werden."
}
$remoteCommit = "$peeledRemote".Split("`t")[0].Trim()
if ($remoteCommit -ne $commit) {
	throw "Remote-Tag '$tag' zeigt auf $remoteCommit statt auf den erwarteten Commit $commit."
}

Write-Host "Tag '$tag' zeigt bestaetigt auf Commit $shortCommit." -ForegroundColor Green

if (-not $SkipDeployWait) {
	Wait-ForPiDeployment -Tag $tag -HostName $PiHost -RepoPath $PiRepoPath -TimeoutSeconds $DeployTimeoutSeconds
} else {
	Write-Host "Pi-Bestaetigung wurde mit -SkipDeployWait uebersprungen." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Release '$tag' erfolgreich abgeschlossen." -ForegroundColor Green
Write-Host "Live-Logs:" -ForegroundColor DarkGray
Write-Host "  ssh $PiHost sudo journalctl -u attribut-generator-update.service -n 80 -f" -ForegroundColor DarkGray
