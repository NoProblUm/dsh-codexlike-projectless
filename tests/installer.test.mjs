import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync, symlinkSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'
import { install, restore } from '../scripts/installer/core.mjs'
import { updateProfile, PLUGIN } from '../scripts/installer/profile.mjs'
import { patches } from '../native/patches.mjs'

const sha = data => createHash('sha256').update(data).digest('hex')
const config = '# keep this comment\n- id: other\n  name: other\n  config:\n    root: C:/other\n'
const pkg = JSON.stringify({ dependencies: { other: '1.0.0' }, unrelated: true })
const lock = "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      other:\n        specifier: 1.0.0\n        version: 1.0.0\npackages:\n  other@1.0.0: {}\nsnapshots:\n  other@1.0.0: {}\n"
function put(path, data) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data) }
function archive(files) {
  const tree = { files: {} }, buffers = []
  let offset = 0
  for (const [path, value] of Object.entries(files)) {
    let current = tree
    const parts = path.split('/')
    for (const part of parts.slice(0, -1)) current = current.files[part] ??= { files: {} }
    const bytes = Buffer.from(value)
    current.files[parts.at(-1)] = { size: bytes.length, offset: String(offset) }
    buffers.push(bytes); offset += bytes.length
  }
  const json = Buffer.from(JSON.stringify(tree)), pickle = Buffer.alloc(8 + Math.ceil(json.length / 4) * 4), size = Buffer.alloc(8)
  pickle.writeUInt32LE(pickle.length - 4); pickle.writeUInt32LE(json.length, 4); json.copy(pickle, 8)
  size.writeUInt32LE(4); size.writeUInt32LE(pickle.length, 4)
  return Buffer.concat([size, pickle, ...buffers])
}
function fixture(t, { version = '0.2.0-rc.2', existing = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'projectless-install-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const bundle = join(root, 'download'), app = join(root, 'DSH with spaces'), profile = join(root, '配置 profile')
  const payload = { 'package.json': JSON.stringify({ name: PLUGIN, version: '0.1.1' }), 'lib/index.js': 'new plugin' }
  const manifest = { pluginName: PLUGIN, pluginVersion: '0.1.1', targetVersion: '0.2.0-rc.2', files: {} }
  for (const [path, value] of Object.entries(payload)) { put(join(bundle, 'payload', path), value); manifest.files['payload/' + path] = sha(value) }
  for (const path of ['installer.cjs', 'install.ps1']) { put(join(bundle, path), 'fixture'); manifest.files[path] = sha('fixture') }
  put(join(bundle, 'bundle.json'), JSON.stringify(manifest))
  put(join(profile, 'package.json'), pkg)
  put(join(profile, 'cordis.patch.yml'), existing ? config + `- id: ${PLUGIN}\n  name: ${PLUGIN}\n  disabled: true\n  config:\n    root: C:/my-work\n` : config)
  put(join(profile, 'pnpm-lock.yaml'), lock)
  if (existing) put(join(profile, 'node_modules', PLUGIN, 'lib/index.js'), 'old plugin')
  const files = {}
  for (const path of Object.keys(patches)) files['dsh/node_modules/@deepseek-ai/' + path] = readFileSync(resolve('node_modules/@deepseek-ai', path))
  files['dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/package.json'] = JSON.stringify({ version })
  put(join(app, 'resources/app.asar'), archive(files))
  const before = readFileSync(join(app, 'resources/app.asar'))
  return { bundle, app, profile, before }
}

test('first install registers plugin, preserves unrelated YAML, repeats and restores exactly', t => {
  const f = fixture(t)
  const first = install(f)
  const dependency = JSON.parse(readFileSync(join(f.profile, 'package.json'))).dependencies[PLUGIN]
  assert.match(dependency, /^link:/)
  assert.ok(existsSync(dependency.slice(5)))
  const configAfter = readFileSync(join(f.profile, 'cordis.patch.yml'), 'utf8')
  assert.match(configAfter, /keep this comment/)
  assert.equal(parse(configAfter)[0].config.root, 'C:/other')
  const after = readFileSync(join(f.app, 'resources/app.asar'))
  assert.notDeepEqual(after, f.before)
  const second = install(f)
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), after)
  restore(second.backup)
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), after)
  restore(first.backup)
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
  assert.equal(readFileSync(join(f.profile, 'package.json'), 'utf8'), pkg)
  assert.equal(readFileSync(join(f.profile, 'cordis.patch.yml'), 'utf8'), config)
  assert.equal(readFileSync(join(f.profile, 'pnpm-lock.yaml'), 'utf8'), lock)
  assert.equal(existsSync(join(f.profile, 'node_modules', PLUGIN)), false)
})

for (const point of ['plugin', 'profile', 'archive']) test(`failure at ${point} restores pre-installation bytes and existing plugin`, t => {
  const f = fixture(t, { existing: true })
  const beforeConfig = readFileSync(join(f.profile, 'cordis.patch.yml'), 'utf8')
  assert.throws(() => install({ ...f, checkpoint: step => { if (step === point) throw new Error('injected failure') } }), /injected failure/)
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
  assert.equal(readFileSync(join(f.profile, 'package.json'), 'utf8'), pkg)
  assert.equal(readFileSync(join(f.profile, 'cordis.patch.yml'), 'utf8'), beforeConfig)
  assert.equal(readFileSync(join(f.profile, 'node_modules', PLUGIN, 'lib/index.js'), 'utf8'), 'old plugin')
})

test('rejects unsupported DSH versions and unknown patched archives before profile writes', t => {
  const f = fixture(t, { version: '0.3.0' })
  assert.throws(() => install(f), /Unsupported DSH version/)
  assert.equal(readFileSync(join(f.profile, 'package.json'), 'utf8'), pkg)
  const valid = fixture(t)
  install(valid)
  const unknown = join(valid.profile, PLUGIN + '-installer')
  rmSync(join(unknown, 'backups'), { recursive: true })
  assert.throws(() => install(valid), /anchor/)
})

test('bundle tampering and active upstream plugin fail before mutation', t => {
  const f = fixture(t)
  put(join(f.bundle, 'payload/lib/index.js'), 'tampered')
  assert.throws(() => install(f), /checksum/)
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
  assert.throws(() => updateProfile(pkg, config + '- id: dsh-projectless-session\n  name: dsh-projectless-session\n', lock, '/persistent'), /Disable/)
})

test('existing plugin root settings survive update; link dependency and lockfile agree', t => {
  const f = fixture(t, { existing: true })
  install(f)
  const entries = parse(readFileSync(join(f.profile, 'cordis.patch.yml'), 'utf8'))
  const entry = entries.find(item => item.id === PLUGIN)
  assert.equal(entry.config.root, 'C:/my-work'); assert.equal(entry.disabled, false)
  const installed = JSON.parse(readFileSync(join(f.profile, 'package.json')))
  const importer = parse(readFileSync(join(f.profile, 'pnpm-lock.yaml'), 'utf8')).importers['.']
  assert.equal(importer.dependencies[PLUGIN].specifier, installed.dependencies[PLUGIN])
  assert.deepEqual(importer.dependencies.other, { specifier: '1.0.0', version: '1.0.0' })
})

test('restoration survives deleting the extracted bundle; rejects damaged backup', t => {
  const f = fixture(t)
  const result = install(f)
  rmSync(f.bundle, { recursive: true })
  assert.ok(existsSync(join(result.state, 'installer.cjs')))
  put(join(result.backup, 'file-0'), 'broken')
  assert.throws(() => restore(result.backup), /Backup checksum/)
  assert.notDeepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
})

test('rollback restores a pnpm directory link without modifying its target', t => {
  const f = fixture(t)
  const store = join(f.profile, 'store/original-plugin')
  put(join(store, 'lib/index.js'), 'store contents')
  const plugin = join(f.profile, 'node_modules', PLUGIN)
  mkdirSync(dirname(plugin), { recursive: true })
  symlinkSync(store, plugin, process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => install({ ...f, checkpoint: step => { if (step === 'plugin') throw new Error('rollback link') } }), /rollback link/)
  assert.ok(lstatSync(plugin).isSymbolicLink())
  assert.equal(readFileSync(join(store, 'lib/index.js'), 'utf8'), 'store contents')
})

test('automatically patches sidebar in the selected profile and restores it', t => {
  const f = fixture(t)
  const sidebar = join(f.profile, 'node_modules/dsh-better-sidebar/lib/client.js')
  const source = 'function query() { if (sessionId === void 0 || summaryCwd !== void 0) return; }'
  put(sidebar, source)
  const result = install(f)
  assert.match(readFileSync(sidebar, 'utf8'), /isProjectlessDraft/)
  restore(result.backup)
  assert.equal(readFileSync(sidebar, 'utf8'), source)
})

test('rejects unsupported Git Graph before writing the application', t => {
  const f = fixture(t)
  put(join(f.profile, 'node_modules/@linxin666/dsh-client-ui-git-graph/package.json'), JSON.stringify({ version: '0.5.0' }))
  put(join(f.profile, 'node_modules/@linxin666/dsh-client-ui-git-graph/lib/client.js'), 'const routed = (workspaceId) => {};')
  assert.throws(() => install(f), /Unsupported Git Graph version/)
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
})


test('restoration refuses to overwrite an application updated after installation', t => {
  const f = fixture(t)
  const result = install(f)
  put(join(f.app, 'resources/app.asar'), 'new DSH application')
  assert.throws(() => restore(result.backup), /changed since installation/)
  assert.equal(readFileSync(join(f.app, 'resources/app.asar'), 'utf8'), 'new DSH application')
})

test('installation honors an exclusive lock without removing another installer lock', t => {
  const f = fixture(t)
  const state = join(f.profile, PLUGIN + '-installer')
  put(join(state, 'installer.lock'), 'another installer')
  assert.throws(() => install(f), /EEXIST/)
  assert.equal(readFileSync(join(state, 'installer.lock'), 'utf8'), 'another installer')
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
})

test('Git Graph 0.4.4 preparation is idempotent across installer updates', t => {
  const f = fixture(t)
  const graph = join(f.profile, 'node_modules/@linxin666/dsh-client-ui-git-graph')
  put(join(graph, 'package.json'), JSON.stringify({ version: '0.4.4' }))
  const source = 'const routed = (workspaceId) => { original.call(navigation); };'
  put(join(graph, 'lib/client.js'), source)
  const first = install(f)
  const patched = readFileSync(join(graph, 'lib/client.js'), 'utf8')
  install(f)
  assert.equal(readFileSync(join(graph, 'lib/client.js'), 'utf8'), patched)
  restore(first.backup)
  assert.equal(readFileSync(join(graph, 'lib/client.js'), 'utf8'), source)
})


test('PowerShell launcher installs a bundled release and restores after downloads are removed', { skip: process.platform !== 'win32' || !existsSync(resolve('output/dsh-codexlike-projectless-0.1.1-windows-installer')) }, t => {
  const f = fixture(t)
  const release = resolve('output/dsh-codexlike-projectless-0.1.1-windows-installer')
  cpSync(release, f.bundle, { recursive: true })
  const launch = (file, args) => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file, ...args], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }
  launch(join(f.bundle, 'install.ps1'), ['-AppDirectory', f.app, '-ProfileDirectory', f.profile])
  const state = join(f.profile, PLUGIN + '-installer')
  const { backup } = JSON.parse(readFileSync(join(state, 'latest.json'), 'utf8'))
  rmSync(f.bundle, { recursive: true })
  launch(join(state, 'install.ps1'), ['-Restore', '-BackupDirectory', backup])
  assert.deepEqual(readFileSync(join(f.app, 'resources/app.asar')), f.before)
  assert.equal(readFileSync(join(f.profile, 'package.json'), 'utf8'), pkg)
})
