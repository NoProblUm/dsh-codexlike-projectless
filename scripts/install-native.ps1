param(
  [string]$AppDirectory,
  [string]$ProfileDirectory = "$env:USERPROFILE\.dsh\profiles\desktop",
  [string]$OriginalArchive
)
$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $source 'package.json') -Raw | ConvertFrom-Json).version
$launcher = Join-Path $source "output\dsh-codexlike-projectless-$version-windows-installer\install.ps1"
if (!(Test-Path -LiteralPath $launcher)) { throw 'Run npm run verify, npm pack --ignore-scripts, and npm run package:installer first, or download the installer ZIP from Releases.' }
$argsForInstaller = @{ ProfileDirectory = $ProfileDirectory; LegacyBackupDirectory = (Join-Path $source 'native\backups') }
if ($AppDirectory) { $argsForInstaller.AppDirectory = $AppDirectory }
if ($OriginalArchive) { $argsForInstaller.OriginalArchive = $OriginalArchive }
& $launcher @argsForInstaller
exit $LASTEXITCODE
