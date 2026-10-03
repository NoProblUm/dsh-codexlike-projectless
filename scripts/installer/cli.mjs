import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { install, restore } from './core.mjs'

const options = {}
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]
  if (!['--bundle', '--app', '--profile', '--original', '--legacy-backups', '--restore'].includes(key) || !process.argv[i + 1]) throw new Error(`Invalid installer argument: ${key}`)
  options[key.slice(2)] = process.argv[i + 1]
}
try {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || major === 22 && minor < 19) throw new Error('Node.js 22.19 or newer is required')
  if (process.platform !== 'win32') throw new Error('This installer supports Windows DSH Desktop only')
  const running = spawnSync('powershell.exe', ['-NoProfile', '-Command', "if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) { exit 2 }"], { windowsHide: true })
  if (running.error || running.status !== 0) throw new Error('Fully quit DSH first; process check failed or DSH is running')
  if (options.restore) {
    const result = restore(options.restore)
    console.log(`Restored / 已恢复: ${result.backup}`)
  } else {
    if (!options.app || !options.profile) throw new Error('--app and --profile are required; run install.ps1')
    const result = install({ bundle: resolve(options.bundle ?? dirname(process.argv[1])), app: options.app, profile: options.profile, original: options.original, legacyBackups: options['legacy-backups'] })
    console.log(`Installed / 已安装: ${result.version}\nBackup / 备份: ${result.backup}\nRestore / 恢复:\npowershell -NoProfile -ExecutionPolicy Bypass -File "${result.state}\\install.ps1" -Restore -BackupDirectory "${result.backup}"`)
  }
} catch (error) {
  console.error(error.message)
  if (error.errors) for (const nested of error.errors) console.error(nested.message)
  process.exitCode = 1
}
