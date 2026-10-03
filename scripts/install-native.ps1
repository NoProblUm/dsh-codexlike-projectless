param(
  [string]$AppDirectory = 'E:\DeepSeekHarness',
  [string]$ProfileDirectory = "$env:USERPROFILE\.dsh\profiles\desktop"
)
$ErrorActionPreference = 'Stop'
$sourceDirectory = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $sourceDirectory 'native\staged\manifest.json') -Raw | ConvertFrom-Json
$target = Join-Path $AppDirectory 'resources\app.asar'
$staged = Join-Path $sourceDirectory 'native\staged\app.asar'
$package = Get-Content -LiteralPath (Join-Path $sourceDirectory 'package.json') -Raw | ConvertFrom-Json
if ($manifest.pluginName -ne $package.name -or $manifest.pluginVersion -ne $package.version) { throw '原生补丁与插件版本不一致，请重新生成配套补丁后安装。' }
$archive = Join-Path $sourceDirectory "dsh-codexlike-projectless-$($package.version).tgz"
$plugin = Join-Path $ProfileDirectory 'node_modules\dsh-codexlike-projectless'
if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) { throw '请完全退出 DSH 后再安装。' }
$currentHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
$knownInstall = Get-ChildItem -LiteralPath (Join-Path $sourceDirectory 'native\backups') -Filter restore.json -Recurse | ForEach-Object {
  $record = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
  if ($record.installedSha256 -eq $currentHash -and ($record.originalSha256 -eq $manifest.originalSha256 -or $record.upstreamSha256 -eq $manifest.originalSha256)) { $record }
} | Select-Object -First 1
if ($currentHash -ne $manifest.originalSha256 -and !$knownInstall) { throw 'DSH 文件与已验证的 0.2.0-rc.2 原版或本地安装备份不一致，停止安装。' }
if ((Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.outputSha256) { throw '暂存补丁校验失败。' }
if (!(Test-Path -LiteralPath $archive) -or !(Test-Path -LiteralPath $plugin)) { throw '请先通过 DSH 插件管理安装本项目的本地包 dsh-codexlike-projectless，再应用原生补丁。' }
$profilePackagePath = Join-Path $ProfileDirectory 'package.json'
$profilePackage = Get-Content -LiteralPath $profilePackagePath -Raw | ConvertFrom-Json
$previousSpecifier = $profilePackage.dependencies.'dsh-codexlike-projectless'
if (!$previousSpecifier) { throw '目标 profile 缺少 dsh-codexlike-projectless 依赖，请先安装本项目插件包。' }
$configPath = Join-Path $ProfileDirectory 'cordis.patch.yml'
$config = Get-Content -LiteralPath $configPath -Raw
$pattern = '(?m)(^- id: dsh-codexlike-projectless\r?\n)(?:(?!^- ).*\r?\n)*'
if ($config -notmatch $pattern) { throw '目标 profile 缺少 dsh-codexlike-projectless 配置，请先安装本项目插件包。' }
$upstreamPattern = '(?m)(^- id: dsh-projectless-session\r?\n)(?:(?!^- ).*(?:\r?\n|$))*'
$upstreamEntry = [regex]::Match($config, $upstreamPattern)
if ($upstreamEntry.Success -and $upstreamEntry.Value -notmatch '(?m)^  disabled: true\r?$') { throw '请先禁用旧插件 dsh-projectless-session，避免两个插件同时接管会话。' }
if (!(Test-Path -LiteralPath (Join-Path $ProfileDirectory 'node_modules\@linxin666\dsh-client-ui-git-graph\package.json')) -and $manifest.gitGraphCompat) { throw '指定 profile 中缺少配套 Git Graph。' }
if ((Test-Path -LiteralPath (Join-Path $ProfileDirectory 'node_modules\@linxin666\dsh-client-ui-git-graph\package.json')) -and !$manifest.gitGraphCompat) { throw '缺少 Git Graph 配套补丁，请先运行 prepare-git-graph-compat.mjs。' }
if ($manifest.sidebarCompat) {
  if ((Get-FileHash -LiteralPath $manifest.sidebarCompat.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sidebarCompat.originalSha256) { throw '增强侧栏兼容文件校验失败。' }
  if ((Get-FileHash -LiteralPath $manifest.sidebarCompat.staged -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sidebarCompat.outputSha256) { throw '增强侧栏暂存文件校验失败。' }
}
if ($manifest.gitGraphCompat) {
  $gitGraphDirectory = Join-Path $ProfileDirectory 'node_modules\@linxin666\dsh-client-ui-git-graph'
  $gitGraphPackage = Get-Content -LiteralPath (Join-Path $gitGraphDirectory 'package.json') -Raw | ConvertFrom-Json
  if ($manifest.targetVersion -ne '0.2.0-rc.2' -or $manifest.gitGraphCompat.version -ne '0.4.4' -or $gitGraphPackage.version -ne $manifest.gitGraphCompat.version) { throw 'Git Graph 兼容版本不匹配。' }
  if ([IO.Path]::GetFullPath($manifest.gitGraphCompat.path) -ne [IO.Path]::GetFullPath((Join-Path $gitGraphDirectory 'lib\client.js'))) { throw 'Git Graph 兼容目标不属于指定 profile。' }
  if ((Get-FileHash -LiteralPath $manifest.gitGraphCompat.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.gitGraphCompat.originalSha256) { throw 'Git Graph 兼容文件校验失败。' }
  if ((Get-FileHash -LiteralPath $manifest.gitGraphCompat.staged -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.gitGraphCompat.outputSha256) { throw 'Git Graph 暂存文件校验失败。' }
}
$backup = Join-Path $sourceDirectory ('native\backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $target -Destination (Join-Path $backup 'app.asar')
foreach ($name in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml')) { Copy-Item -LiteralPath (Join-Path $ProfileDirectory $name) -Destination (Join-Path $backup $name) }
Copy-Item -LiteralPath $plugin -Destination (Join-Path $backup 'plugin') -Recurse
if ($manifest.sidebarCompat) { Copy-Item -LiteralPath $manifest.sidebarCompat.path -Destination (Join-Path $backup 'better-sidebar-client.js') }
if ($manifest.gitGraphCompat) { Copy-Item -LiteralPath $manifest.gitGraphCompat.path -Destination (Join-Path $backup 'git-graph-client.js') }
@{ pluginName = $package.name; appDirectory = $AppDirectory; profileDirectory = $ProfileDirectory; originalSha256 = $currentHash; upstreamSha256 = $manifest.originalSha256; installedSha256 = $manifest.outputSha256; sidebarCompat = $manifest.sidebarCompat; gitGraphCompat = $manifest.gitGraphCompat } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $backup 'restore.json') -Encoding utf8
try {
  Copy-Item -LiteralPath $staged -Destination $target -Force
  if ($manifest.sidebarCompat) { Copy-Item -LiteralPath $manifest.sidebarCompat.staged -Destination $manifest.sidebarCompat.path -Force }
  if ($manifest.gitGraphCompat) { Copy-Item -LiteralPath $manifest.gitGraphCompat.staged -Destination $manifest.gitGraphCompat.path -Force }
  foreach ($name in @('lib', 'docs', 'package.json', 'cordis.patch.yml', 'CHANGELOG.md', 'README.md', 'README.zh-CN.md', 'NOTICE', 'LICENSE')) {
    Copy-Item -LiteralPath (Join-Path $sourceDirectory $name) -Destination $plugin -Recurse -Force
  }
  $specifier = 'file:' + $archive.Replace('\', '/')
  $profilePackage.dependencies.'dsh-codexlike-projectless' = $specifier
  $profilePackage | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $profilePackagePath -Encoding utf8
  $lockPath = Join-Path $ProfileDirectory 'pnpm-lock.yaml'
  $lock = Get-Content -LiteralPath $lockPath -Raw
  $oldPackage = [regex]::Escape('dsh-codexlike-projectless@' + $previousSpecifier + ':')
  $hash = [System.Security.Cryptography.SHA512]::Create()
  try { $integrity = 'sha512-' + [Convert]::ToBase64String($hash.ComputeHash([IO.File]::ReadAllBytes($archive))) } finally { $hash.Dispose() }
  $lock = [regex]::Replace($lock, "($oldPackage\r?\n\s+resolution: \{integrity: )[^,]+", { param($match) $match.Groups[1].Value + $integrity })
  $lock.Replace($previousSpecifier, $specifier) | Set-Content -LiteralPath $lockPath -Encoding utf8
  $config = [regex]::Replace($config, $pattern, { param($match) [regex]::Replace($match.Value, '(?m)^  disabled: true', '  disabled: false') })
  Set-Content -LiteralPath $configPath -Value $config -Encoding utf8
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.outputSha256) { throw '安装后校验失败。' }
  if ($manifest.gitGraphCompat -and (Get-FileHash -LiteralPath $manifest.gitGraphCompat.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.gitGraphCompat.outputSha256) { throw 'Git Graph 安装后校验失败。' }
  Write-Output "Installed $($package.version). Backup: $backup"
} catch {
  & (Join-Path $PSScriptRoot 'restore-native.ps1') -BackupDirectory $backup
  throw
}
