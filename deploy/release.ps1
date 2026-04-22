[CmdletBinding()]
param(
	[string]$Version,
	[string]$Message = "Release"
)

$ErrorActionPreference = "Stop"

# Aktueller Branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "master" -and $branch -ne "main") {
	Write-Warning "Du bist auf '$branch'. Tag wird trotzdem auf diesem Commit erstellt."
}

# Sicherstellen dass alles gepusht ist
$status = git status --porcelain
if ($status) {
	Write-Error "Working tree ist nicht clean. Bitte erst committen oder stashen.`n$status"
	exit 1
}

git pull --ff-only

# Tag-Name bestimmen
if ($Version) {
	$tag = "v$($Version.TrimStart('v'))"
} else {
	$base = "deploy-" + (Get-Date -Format "yyyy-MM-dd")
	$existing = git tag -l "$base*" | Measure-Object | Select-Object -ExpandProperty Count
	$tag = "$base-" + ($existing + 1)
}

Write-Host ""
Write-Host "==> Erstelle Tag: $tag" -ForegroundColor Cyan
Write-Host "    Message:      $Message"
Write-Host ""

git tag -a $tag -m $Message
git push origin master --follow-tags

Write-Host ""
Write-Host "Tag '$tag' gepusht. Pi deployed beim naechsten Cron-Run (max. 5 Min)." -ForegroundColor Green
Write-Host "Status live mitlesen:" -ForegroundColor DarkGray
Write-Host "  ssh marcel@100.87.118.91 'tail -f /var/log/attribut-generator-deploy.log'" -ForegroundColor DarkGray
