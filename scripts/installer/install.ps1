param(
  [string]$AppDirectory,
  [string]$ProfileDirectory = "$env:USERPROFILE\.dsh\profiles\desktop",
  [string]$OriginalArchive,
  [string]$LegacyBackupDirectory,
  [switch]$Restore,
  [string]$BackupDirectory
)
$ErrorActionPreference = 'Stop'
try {
  if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) { throw 'Please fully quit DSH first / 请先完全退出 DSH。' }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (!$node) { throw 'Install Node.js 22.19 or newer first / 请先安装 Node.js 22.19 或更新版本。' }
  $installerArgs = @((Join-Path $PSScriptRoot 'installer.cjs'))
  if ($Restore) {
    if (!$BackupDirectory) {
      $latest = Join-Path $PSScriptRoot 'latest.json'
      if (!(Test-Path -LiteralPath $latest)) { throw 'Pass -BackupDirectory / 请指定备份目录。' }
      $BackupDirectory = (Get-Content -LiteralPath $latest -Raw | ConvertFrom-Json).backup
    }
    $installerArgs += @('--restore', $BackupDirectory)
  } else {
    if (!$AppDirectory) {
      $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
        (Join-Path $env:LOCALAPPDATA 'DeepSeek Harness'),
        (Join-Path $env:ProgramFiles 'DeepSeek Harness'),
        'E:\DeepSeekHarness'
      )
      foreach ($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
        Get-ItemProperty $key -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*DeepSeek*Harness*' } | ForEach-Object {
          if ($_.InstallLocation) { $candidates += $_.InstallLocation }
          if ($_.DisplayIcon) {
            $icon = ($_.DisplayIcon -replace ',\d+$', '').Trim('"')
            $candidates += Split-Path -Parent $icon
          }
        }
      }
      $found = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'resources\app.asar')) } | Select-Object -Unique)
      if ($found.Count -eq 1) { $AppDirectory = $found[0] }
      else {
        if ($found.Count -gt 1) { Write-Host ('Detected multiple installations / 找到多个安装目录: ' + ($found -join ', ')) }
        $AppDirectory = (Read-Host 'DSH installation directory / 请输入 DSH 安装目录').Trim('"')
      }
    }
    if (!$AppDirectory -or !(Test-Path -LiteralPath (Join-Path $AppDirectory 'resources\app.asar'))) { throw 'DSH resources/app.asar not found / 找不到 DSH resources/app.asar。' }
    $installerArgs += @('--bundle', $PSScriptRoot, '--app', $AppDirectory, '--profile', $ProfileDirectory)
    if ($OriginalArchive) { $installerArgs += @('--original', $OriginalArchive) }
    if ($LegacyBackupDirectory) { $installerArgs += @('--legacy-backups', $LegacyBackupDirectory) }
  }
  & $node.Source @installerArgs
  if ($LASTEXITCODE -ne 0) { throw "Installer failed / 安装器失败 (exit $LASTEXITCODE)" }
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
}
