#Requires -RunAsAdministrator

<#
    Erstellt einen lokalen Benutzer, setzt NTFS-Rechte auf G:\Downloads
    und gibt den Ordner als SMB-Freigabe frei.

    Standardwerte:
    - Benutzername: lager
    - Freigabename: Downloads
    - Ordner: G:\Downloads
#>

param(
    [string]$Username = "iphone",
    [string]$ShareName = "Downloads",
    [string]$FolderPath = "G:\Downloads",
    [switch]$ReadOnly
)

$ErrorActionPreference = "Stop"

try {
    Write-Host "Prüfe Ordnerpfad ..." -ForegroundColor Cyan
    if (-not (Test-Path -Path $FolderPath -PathType Container)) {
        throw "Der Ordner '$FolderPath' existiert nicht."
    }

    Write-Host "Prüfe, ob Benutzer '$Username' bereits existiert ..." -ForegroundColor Cyan
    $existingUser = Get-LocalUser -Name $Username -ErrorAction SilentlyContinue

    if (-not $existingUser) {
        $password = Read-Host "Passwort für Benutzer '$Username' eingeben" -AsSecureString

        Write-Host "Erstelle lokalen Benutzer '$Username' ..." -ForegroundColor Cyan
        New-LocalUser `
            -Name $Username `
            -Password $password `
            -FullName "$Username Freigabebenutzer" `
            -Description "Benutzer für Netzwerkfreigabe $ShareName" | Out-Null

        Write-Host "Füge Benutzer zur Gruppe 'Benutzer' hinzu ..." -ForegroundColor Cyan
        Add-LocalGroupMember -Group "Benutzer" -Member $Username
    }
    else {
        Write-Host "Benutzer '$Username' existiert bereits. Überspringe Benutzeranlage." -ForegroundColor Yellow
    }

    Write-Host "Setze NTFS-Berechtigungen auf '$FolderPath' ..." -ForegroundColor Cyan
    if ($ReadOnly) {
        & icacls $FolderPath /grant ("{0}:(OI)(CI)RX" -f $Username) | Out-Null
    }
    else {
        & icacls $FolderPath /grant ("{0}:(OI)(CI)M" -f $Username) | Out-Null
    }

    Write-Host "Prüfe, ob SMB-Freigabe '$ShareName' bereits existiert ..." -ForegroundColor Cyan
    $existingShare = Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue

    if ($existingShare) {
        Write-Host "Freigabe '$ShareName' existiert bereits. Entferne vorhandene Freigabe ..." -ForegroundColor Yellow
        Remove-SmbShare -Name $ShareName -Force
    }

    Write-Host "Erstelle SMB-Freigabe '$ShareName' ..." -ForegroundColor Cyan
    if ($ReadOnly) {
        New-SmbShare -Name $ShareName -Path $FolderPath -ReadAccess $Username | Out-Null
    }
    else {
        New-SmbShare -Name $ShareName -Path $FolderPath -ChangeAccess $Username | Out-Null
    }

    $computerName = $env:COMPUTERNAME

    Write-Host "" 
    Write-Host "Fertig." -ForegroundColor Green
    Write-Host "Benutzer: $Username"
    Write-Host "Ordner:   $FolderPath"
    Write-Host "Freigabe: \\$computerName\$ShareName"

    if ($ReadOnly) {
        Write-Host "Rechte:   Lesen" 
    }
    else {
        Write-Host "Rechte:   Lesen / Schreiben / Ändern"
    }

    Write-Host "Anmeldung im Netzwerk mit: $computerName\$Username"
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}

