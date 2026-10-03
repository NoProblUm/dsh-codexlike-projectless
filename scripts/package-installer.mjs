import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { build } from 'esbuild'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const name = `${pkg.name}-${pkg.version}-windows-installer`
const directory = resolve('output', name)
rmSync(directory, { recursive: true, force: true })
mkdirSync(join(directory, 'payload'), { recursive: true })
for (const path of ['package.json', ...pkg.files]) cpSync(path, join(directory, 'payload', path), { recursive: true, filter: () => true })
for (const path of ['install.ps1', 'Install.cmd']) {
  const text = readFileSync(join('scripts/installer', path), 'utf8').replaceAll('\n', '\r\n')
  writeFileSync(join(directory, path), (path.endsWith('.ps1') ? '\uFEFF' : '') + text)
}
for (const path of ['README.md', 'README.zh-CN.md', `${pkg.name}-${pkg.version}.tgz`]) cpSync(path, join(directory, path))
await build({ entryPoints: ['scripts/installer/cli.mjs'], outfile: join(directory, 'installer.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node22' })
const files = {}
function walk(path, prefix = '') {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const relative = prefix + entry.name
    if (entry.isDirectory()) walk(join(path, entry.name), relative + '/')
    else files[relative] = createHash('sha256').update(readFileSync(join(path, entry.name))).digest('hex')
  }
}
walk(directory)
writeFileSync(join(directory, 'bundle.json'), JSON.stringify({ pluginName: pkg.name, pluginVersion: pkg.version, targetVersion: '0.2.0-rc.2', files }, null, 2) + '\n')
if (!process.argv.includes('--directory-only')) {
  const archive = directory + '.zip'
  rmSync(archive, { force: true })
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Compress-Archive -LiteralPath $env:DSH_INSTALLER_SOURCE -DestinationPath $env:DSH_INSTALLER_ZIP'], { stdio: 'inherit', env: { ...process.env, DSH_INSTALLER_SOURCE: directory, DSH_INSTALLER_ZIP: archive } })
    : spawnSync('zip', ['-qr', archive, name], { cwd: resolve('output'), stdio: 'inherit' })
  if (result.error || result.status !== 0) throw result.error ?? new Error('Installer ZIP creation failed')
  console.log(archive)
} else console.log(directory)
