import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const root = resolve('native')
const archive = process.env.DSH_TEST_ARCHIVE ?? resolve(root, 'staged/app.asar')
const child = spawn('E:/DeepSeekHarness/DeepSeek Harness.exe', ['--expose-internals',
  archive + '/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js', ...process.argv.slice(2)], {
  windowsHide: true, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: resolve(root, 'test-home') },
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
