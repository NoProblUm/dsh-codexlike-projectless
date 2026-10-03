param([Parameter(Mandatory)][string]$BackupDirectory)
$ErrorActionPreference = 'Stop'
$backup = (Resolve-Path -LiteralPath $BackupDirectory).Path
$record = Get-Content -LiteralPath (Join-Path $backup 'restore.json') -Raw | ConvertFrom-Json
if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) { throw '请完全退出 DSH 后再恢复。' }
$pluginName = if ($record.pluginName) { $record.pluginName } else { 'dsh-projectless-session' }
if ($pluginName -notin @('dsh-codexlike-projectless', 'dsh-projectless-session')) { throw '备份中的插件身份不受支持。' }
$archive = Join-Path $backup 'app.asar'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.originalSha256) { throw '原版备份校验失败。' }
if ($record.gitGraphCompat -and (Get-FileHash -LiteralPath (Join-Path $backup 'git-graph-client.js') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.gitGraphCompat.originalSha256) { throw 'Git Graph 备份校验失败。' }
Copy-Item -LiteralPath $archive -Destination (Join-Path $record.appDirectory 'resources\app.asar') -Force
if ($record.sidebarCompat) { Copy-Item -LiteralPath (Join-Path $backup 'better-sidebar-client.js') -Destination $record.sidebarCompat.path -Force }
if ($record.gitGraphCompat) { Copy-Item -LiteralPath (Join-Path $backup 'git-graph-client.js') -Destination $record.gitGraphCompat.path -Force }
foreach ($name in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml')) { Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $record.profileDirectory $name) -Force }
$plugin = Join-Path $record.profileDirectory ('node_modules\' + $pluginName)
# Restore existing files without deleting user data or following directory links.
Get-ChildItem -LiteralPath (Join-Path $backup 'plugin') | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $plugin -Recurse -Force }
Write-Output "Restored original DSH and plugin configuration from $backup"
