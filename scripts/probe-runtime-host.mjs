import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Run the stock web Host with a fresh, exclusively test-owned profile. No keys,
// user profiles, installed packages or archive contents are modified or copied.
const root = resolve(process.argv[2] ?? 'output/runtime-adapter-rc1')
const port = Number(process.argv[3] ?? 18540)
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535)
const candidate = process.argv.includes('--candidate')
const archive = resolve('output/bridge-feasibility/desktop-7/app/resources/app.asar')
const original = '983ca71114e6dfd353fc79af5a1f9481a250ee64c2a3c757673029b811b23bc2'
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), original)
mkdirSync(root)
const home = join(root, 'home')
const profile = join(home, 'profiles/web')
mkdirSync(profile, { recursive: true })
const plugin = candidate ? 'dsh-codexlike-projectless' : 'dsh-runtime-adapter-probe'
const pluginDirectory = join(profile, 'node_modules', plugin)
if (candidate) {
  mkdirSync(pluginDirectory, { recursive: true })
  for (const file of ['lib', 'package.json', 'cordis.patch.yml']) cpSync(file, join(pluginDirectory, file), { recursive: true })
  cpSync('experiments/runtime-acceptance', join(profile, 'node_modules/dsh-runtime-acceptance'), { recursive: true })
} else cpSync('experiments/runtime-adapter-probe', pluginDirectory, { recursive: true })
writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', plugin, ...candidate ? ['dsh-runtime-acceptance'] : []] } } }, null, 2))
writeFileSync(join(profile, 'cordis.yml'), '[]\n')
writeFileSync(join(profile, 'cordis.patch.yml'), candidate ? `- id: dsh-codexlike-projectless\n  config:\n    root: ${JSON.stringify(join(root, 'tasks'))}\n    debug: true\n- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(join(root, 'documents'))}\n` : '[]\n')
if (candidate) mkdirSync(join(root, 'documents'))
writeFileSync(join(root, 'identity.json'), JSON.stringify({ archive, originalSha256: original, home, port }, null, 2))
const child = spawn('E:/DeepSeekHarness/DeepSeek Harness.exe', ['--expose-internals', archive + '/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js', 'web', '--no-open', '--host', '127.0.0.1', '--port', String(port)], {
  windowsHide: true,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: home },
})
writeFileSync(join(root, 'process.json'), JSON.stringify({ launcherPid: process.pid, hostPid: child.pid }))
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
