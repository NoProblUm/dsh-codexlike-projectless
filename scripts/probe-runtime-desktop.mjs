import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, openSync, readFileSync, writeFileSync, closeSync } from 'node:fs'
import { join, resolve } from 'node:path'

const mode = process.argv[2] ?? 'start'
const root = resolve(process.argv[3] ?? 'output/runtime-candidate-desktop-1')
const app = resolve('output/bridge-feasibility/desktop-7/app')
const executable = join(app, 'DeepSeek Harness.exe')
const archive = join(app, 'resources/app.asar')
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), '983ca71114e6dfd353fc79af5a1f9481a250ee64c2a3c757673029b811b23bc2')
const mainPort = 19401
async function evaluate(expression) {
  const targets = await (await fetch(`http://127.0.0.1:${mainPort}/json/list`)).json()
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Desktop evaluation timed out')), 10000)
      socket.addEventListener('message', event => {
        const result = JSON.parse(event.data)
        if (result.id !== 1) return
        clearTimeout(timeout)
        if (result.error || result.result.exceptionDetails) reject(new Error(JSON.stringify(result.error ?? result.result.exceptionDetails)))
        else resolve(result.result.result.value)
      })
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
    })
  } finally { socket.close() }
}

if (mode === 'menus') {
  const identity = JSON.parse(readFileSync(join(root, 'process.json')))
  assert.equal(await evaluate('process.pid'), identity.desktopPid)
  console.log(JSON.stringify(await evaluate(`(() => {const {Menu}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');const list=menu=>menu?.items.map(item=>({id:item.id,label:item.label,children:list(item.submenu)}));return list(Menu.getApplicationMenu())})()`), null, 2))
} else if (mode === 'trace-visibility') {
  const identity = JSON.parse(readFileSync(join(root, 'process.json')))
  assert.equal(await evaluate('process.pid'), identity.desktopPid)
  console.log(await evaluate(`(() => {const {BrowserWindow}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');globalThis.__runtimeWindowTrace??=[];for(const w of BrowserWindow.getAllWindows()){if(w.__runtimeTraced)continue;w.__runtimeTraced=true;for(const name of ['hide','show','close']){const original=w[name];w[name]=function(...args){globalThis.__runtimeWindowTrace.push({name,url:w.webContents.getURL(),stack:new Error().stack});return original.apply(this,args)}}}return globalThis.__runtimeWindowTrace})()`))
} else if (mode === 'inspect') {
  const identity = JSON.parse(readFileSync(join(root, 'process.json')))
  const facts = await evaluate(`(() => {const {app,BrowserWindow}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');return {pid:process.pid,home:process.env.DSH_HOME,ready:app.isReady(),trace:globalThis.__runtimeWindowTrace,windows:BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),visible:w.isVisible(),focused:w.isFocused(),focusable:w.isFocusable(),enabled:w.isEnabled(),bounds:w.getBounds(),loading:w.webContents.isLoadingMainFrame()}))}})()`)
  assert.equal(facts.pid, identity.desktopPid)
  assert.equal(facts.home, join(root, 'home'))
  console.log(JSON.stringify(facts, null, 2))
} else if (mode === 'focus') {
  const identity = JSON.parse(readFileSync(join(root, 'process.json')))
  const facts = await evaluate('({pid:process.pid,home:process.env.DSH_HOME})')
  assert.equal(facts.pid, identity.desktopPid)
  assert.equal(facts.home, join(root, 'home'))
  const environment = { ...process.env, DSH_HOME: join(root, 'home'), DSHM_REGISTRY_URL: 'http://127.0.0.1:18549/registry.json', DSHM_NPM_MIRROR: 'http://127.0.0.1:18550' }
  delete environment.ELECTRON_RUN_AS_NODE
  delete environment.ELECTRON_NO_ASAR
  const child = spawn(executable, ['--user-data-dir=' + join(root, 'user-data')], { env: environment, cwd: app, windowsHide: false, detached: true, stdio: 'ignore' })
  child.unref()
  console.log('Requested the native single-instance focus action')
} else if (mode === 'native-new' || mode === 'native-menu' || mode === 'focus-window') {
  const identity = JSON.parse(readFileSync(join(root, 'process.json')))
  assert.equal(await evaluate('process.pid'), identity.desktopPid)
  const key = mode === 'native-new' ? 'N' : 'Alt'
  const modifiers = mode === 'native-new' ? ['control'] : []
  console.log(await evaluate(`(() => {const {BrowserWindow}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='dsh-app://app/');w.show();w.focus();w.webContents.focus();if(!w.isFocused())throw new Error('Test window is not focused');if(${JSON.stringify(mode)}=== 'focus-window')return 'Focused test-owned window';w.webContents.sendInputEvent({type:'keyDown',keyCode:${JSON.stringify(key)},modifiers:${JSON.stringify(modifiers)}});w.webContents.sendInputEvent({type:'keyUp',keyCode:${JSON.stringify(key)},modifiers:${JSON.stringify(modifiers)}});return 'Injected through Electron before-input-event, not renderer DOM dispatch'})()`))
} else if (mode === 'stop') {
  const identity = JSON.parse(readFileSync(join(root, 'process.json')))
  const actual = await evaluate('({pid:process.pid,home:process.env.DSH_HOME,execPath:process.execPath})')
  assert.equal(actual.pid, identity.desktopPid)
  assert.equal(actual.home, join(root, 'home'))
  assert.equal(actual.execPath, executable)
  await evaluate(`(() => {const e=process.getBuiltinModule('module').createRequire(process.execPath)('electron');setTimeout(()=>e.app.quit(),100);return true})()`)
  console.log('Requested normal quit of test-owned Desktop ' + actual.pid)
} else if (mode === 'start' || mode === 'restart') {
  if (mode === 'start') {
    mkdirSync(root)
    const profile = join(root, 'home/profiles/desktop')
    mkdirSync(profile, { recursive: true })
    cpSync('experiments/runtime-acceptance', join(profile, 'node_modules/dsh-runtime-acceptance'), { recursive: true })
    writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-runtime-acceptance'] } } }, null, 2))
    writeFileSync(join(profile, 'cordis.yml'), '[]\n')
    mkdirSync(join(root, 'documents'))
    writeFileSync(join(profile, 'cordis.patch.yml'), `- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(join(root, 'documents'))}\n`)
    mkdirSync(join(root, 'home/storages'), { recursive: true })
    writeFileSync(join(root, 'home/storages/dsh-codexlike-projectless-settings.json'), JSON.stringify({ root: join(root, 'tasks') }))
    const protocol = spawnSync('powershell.exe', ['-NoProfile', '-Command', "(Get-Item -LiteralPath 'HKCU:\\Software\\Classes\\dsh\\shell\\open\\command').GetValue('') | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true })
    if (protocol.status !== 0) throw new Error('Cannot snapshot existing dsh protocol association')
    writeFileSync(join(root, 'protocol-before.json'), protocol.stdout.trim())
  }
  const environment = { ...process.env, DSH_HOME: join(root, 'home'), DSHM_REGISTRY_URL: 'http://127.0.0.1:18549/registry.json', DSHM_NPM_MIRROR: 'http://127.0.0.1:18550' }
  delete environment.ELECTRON_RUN_AS_NODE
  delete environment.ELECTRON_NO_ASAR
  delete environment.NODE_OPTIONS
  const out = openSync(join(root, 'desktop.out.log'), 'a')
  const err = openSync(join(root, 'desktop.err.log'), 'a')
  const child = spawn(executable, [`--inspect=127.0.0.1:${mainPort}`, '--remote-debugging-port=19402', '--user-data-dir=' + join(root, 'user-data')], { env: environment, cwd: app, windowsHide: false, detached: true, stdio: ['ignore', out, err] })
  closeSync(out); closeSync(err)
  child.unref()
  writeFileSync(join(root, 'process.json'), JSON.stringify({ desktopPid: child.pid, mainPort, rendererPort: 19402, home: environment.DSH_HOME, executable, archive }))
  console.log(JSON.stringify({ desktopPid: child.pid, root, rendererPort: 19402 }))
} else if (mode === 'restore-protocol') {
  const previous = JSON.parse(readFileSync(join(root, 'protocol-before.json'), 'utf8'))
  const command = "$key='HKCU:\\Software\\Classes\\dsh\\shell\\open\\command';$current=(Get-Item -LiteralPath $key).GetValue('');if($current -ne $env:DSH_TEST_PREVIOUS){if(!$current.Contains($env:DSH_TEST_EXECUTABLE)){throw 'Protocol owner changed outside this test'};Set-Item -LiteralPath $key -Value $env:DSH_TEST_PREVIOUS};(Get-Item -LiteralPath $key).GetValue('') | ConvertTo-Json -Compress"
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true, env: { ...process.env, DSH_TEST_PREVIOUS: previous, DSH_TEST_EXECUTABLE: executable } })
  if (result.status !== 0 || JSON.parse(result.stdout) !== previous) throw new Error('Protocol cleanup did not verify')
  writeFileSync(join(root, 'protocol-cleanup.json'), JSON.stringify({ restored: true }))
  console.log('Verified original protocol association restored')
} else throw new Error('Unknown test operation')
