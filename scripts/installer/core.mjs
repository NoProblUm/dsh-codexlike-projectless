import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, renameSync, readdirSync, lstatSync, readlinkSync, symlinkSync } from 'node:fs'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { openAsar } from '../asar.mjs'
import { patches } from '../../native/patches.mjs'
import { patchGitGraph } from '../../native/git-graph-compat.mjs'
import { rewriteArchive } from './archive.mjs'
import { PLUGIN, updateProfile } from './profile.mjs'

export const TARGET = '0.2.0-rc.2'
const hash = data => createHash('sha256').update(data).digest('hex')
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const sha = path => hash(readFileSync(path))
// Avoid Node's native recursive copy fast path: on Windows, path/permission
// errors can terminate the process instead of throwing (nodejs/node#63970).
// Every recursive cpSync below uses a filter to retain catchable rollback errors.
const present = path => { try { lstatSync(path); return true } catch (e) { if (e.code === 'ENOENT') return false; throw e } }
function atomicWrite(path, data) {
  const temp = path + '.' + randomUUID() + '.tmp'
  try { writeFileSync(temp, data); renameSync(temp, path) } finally { rmSync(temp, { force: true }) }
}
function syntax(source, directory) {
  const path = join(directory, randomUUID() + '.mjs')
  try {
    writeFileSync(path, source)
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', windowsHide: true })
    if (result.error || result.status !== 0) throw new Error(`Patched JavaScript failed syntax validation: ${result.error?.message ?? result.stderr}`)
  } finally { rmSync(path, { force: true }) }
}

export function verifyBundle(bundle) {
  const manifest = json(join(bundle, 'bundle.json'))
  if (manifest.pluginName !== PLUGIN || manifest.targetVersion !== TARGET) throw new Error('Unsupported installer bundle')
  for (const [path, expected] of Object.entries(manifest.files)) {
    const full = resolve(bundle, path)
    if (relative(bundle, full).startsWith('..') || isAbsolute(relative(bundle, full)) || sha(full) !== expected) throw new Error(`Bundle checksum failed: ${path}`)
  }
  const pkg = json(join(bundle, 'payload/package.json'))
  if (pkg.name !== PLUGIN || pkg.version !== manifest.pluginVersion) throw new Error('Plugin and installer versions differ')
  return manifest
}

function fileHashes(root, prefix = '') {
  const result = {}
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name), name = prefix + entry.name
    if (entry.isDirectory()) Object.assign(result, fileHashes(path, name + '/'))
    else result[name] = sha(path)
  }
  return result
}

function backupRecords(state, legacyBackups) {
  const records = []
  for (const root of [join(state, 'backups'), legacyBackups].filter(Boolean)) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = join(root, entry.name, 'restore.json')
      if (entry.isDirectory() && existsSync(path)) records.push({ ...json(path), directory: dirname(path) })
    }
  }
  return records
}

function compatibleFiles(profile, staging) {
  const files = []
  const sidebar = join(profile, 'node_modules/dsh-better-sidebar/lib/client.js')
  if (existsSync(sidebar)) {
    const source = readFileSync(sidebar, 'utf8')
    const before = 'if (sessionId === void 0 || summaryCwd !== void 0) return;'
    const after = 'if (sessionId === void 0 || summaryCwd !== void 0 || ctx.sessions.isProjectlessDraft?.(sessionId)) return;'
    const anchor = source.includes(after) ? after : before
    if (source.indexOf(anchor) < 0 || source.indexOf(anchor) !== source.lastIndexOf(anchor)) throw new Error('Unsupported better-sidebar compatibility anchor')
    const patched = source.replace(before, after)
    syntax(patched, staging)
    files.push({ path: sidebar, data: patched })
  } else if (existsSync(join(profile, 'node_modules/dsh-better-sidebar/package.json'))) throw new Error('Missing better-sidebar client file')
  const graph = join(profile, 'node_modules/@linxin666/dsh-client-ui-git-graph')
  if (existsSync(join(graph, 'package.json'))) {
    const path = join(graph, 'lib/client.js')
    const source = readFileSync(path, 'utf8')
    const patched = patchGitGraph(source, json(join(graph, 'package.json')).version)
    syntax(patched, staging)
    files.push({ path, data: patched })
  }
  return files
}

export function install({ bundle, app, profile, state = join(profile, PLUGIN + '-installer'), original, legacyBackups, checkpoint = () => {} }) {
  bundle = resolve(bundle); app = resolve(app); profile = resolve(profile); state = resolve(state)
  const manifest = verifyBundle(bundle)
  const target = join(app, 'resources/app.asar')
  const currentHash = sha(target)
  const records = backupRecords(state, legacyBackups)
  const known = records.find(record => record.installedSha256 === currentHash && resolve(record.appDirectory) === app && resolve(record.profileDirectory) === profile)
  let upstream = original ? resolve(original) : known?.upstreamArchive
  // Legacy records kept the previous archive as app.asar. Search the whole chain
  // for the unmodified archive, checking bytes rather than trusting its filename.
  const expectedUpstream = known?.upstreamSha256 ?? known?.originalSha256
  if (known && !upstream) upstream = records.map(record => join(record.directory, 'app.asar')).find(path => existsSync(path) && sha(path) === expectedUpstream)
  upstream ??= target
  if (known && sha(upstream) !== expectedUpstream) throw new Error('Original DSH backup checksum failed')
  if (!known && upstream !== target && sha(upstream) !== currentHash) throw new Error('Current DSH archive is not a recognized installation; supply matching legacy backups')
  const profilePackage = join(profile, 'package.json')
  const profileConfig = join(profile, 'cordis.patch.yml')
  const lock = join(profile, 'pnpm-lock.yaml')
  const packageDir = join(state, 'packages', manifest.pluginVersion + '-' + sha(join(bundle, 'bundle.json')).slice(0, 12))
  const changedProfile = updateProfile(readFileSync(profilePackage, 'utf8').replace(/^\uFEFF/, ''), readFileSync(profileConfig, 'utf8'), existsSync(lock) ? readFileSync(lock, 'utf8') : undefined, packageDir)
  mkdirSync(state, { recursive: true })
  // An exclusive lock also covers backup creation and restore; no concurrent writes.
  const lockPath = join(state, 'installer.lock')
  writeFileSync(lockPath, String(process.pid), { flag: 'wx' })
  const staging = join(state, 'staging-' + randomUUID())
  let backup
  try {
    mkdirSync(staging)
    const archive = openAsar(upstream)
    let patched
    try {
      const version = JSON.parse(archive.read('dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/package.json')).version
      if (version !== TARGET) throw new Error(`Unsupported DSH version: ${version}; expected ${TARGET}`)
      const replacements = new Map()
      for (const [path, patch] of Object.entries(patches)) {
        const entry = 'dsh/node_modules/@deepseek-ai/' + path
        const after = patch(archive.read(entry).toString('utf8'))
        syntax(after, staging)
        replacements.set(entry, Buffer.from(after))
      }
      patched = rewriteArchive(archive, replacements)
    } finally { archive.close() }
    const compatibility = compatibleFiles(profile, staging)
    const plugin = join(profile, 'node_modules', PLUGIN)
    // Snapshot before any profile/application mutation, including a first install.
    backup = join(state, 'backups', new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8))
    mkdirSync(backup, { recursive: true })
    cpSync(target, join(backup, 'app.asar'))
    const upstreamArchive = join(state, 'originals', sha(upstream) + '.asar')
    mkdirSync(dirname(upstreamArchive), { recursive: true })
    if (existsSync(upstreamArchive)) {
      if (sha(upstreamArchive) !== sha(upstream)) throw new Error('Stored original archive checksum failed')
    } else cpSync(upstream, upstreamArchive)
    const files = [profilePackage, profileConfig, lock, ...compatibility.map(file => file.path)].map((path, index) => {
      const exists = existsSync(path)
      const stored = 'file-' + index
      if (exists) cpSync(path, join(backup, stored))
      return { path, stored, exists, sha256: exists ? sha(path) : null }
    })
    const pluginExists = present(plugin)
    const pluginLink = pluginExists && lstatSync(plugin).isSymbolicLink() ? readlinkSync(plugin) : null
    if (pluginExists) cpSync(plugin, join(backup, 'plugin'), { recursive: true, dereference: true, filter: () => true })
    const record = { schema: 2, pluginName: PLUGIN, appDirectory: app, profileDirectory: profile, originalSha256: currentHash, upstreamSha256: sha(upstream), upstreamArchive, installedSha256: hash(patched), files, pluginExists, pluginLink, pluginHashes: pluginExists ? fileHashes(join(backup, 'plugin')) : {} }
    writeFileSync(join(backup, 'restore.json'), JSON.stringify(record, null, 2) + '\n')
    checkpoint('backed-up')
    try {
      if (!existsSync(packageDir)) cpSync(join(bundle, 'payload'), packageDir, { recursive: true, filter: () => true })
      for (const [path, expected] of Object.entries(manifest.files)) {
        if (path.startsWith('payload/') && sha(join(packageDir, path.slice(8))) !== expected) throw new Error('Stored plugin checksum failed: ' + path)
      }
      // Replace the top-level pnpm link, never write through it into its store.
      rmSync(plugin, { recursive: true, force: true })
      mkdirSync(dirname(plugin), { recursive: true })
      cpSync(packageDir, plugin, { recursive: true, filter: () => true })
      checkpoint('plugin')
      atomicWrite(profilePackage, changedProfile.package)
      atomicWrite(profileConfig, changedProfile.config)
      if (changedProfile.lock !== undefined) atomicWrite(lock, changedProfile.lock)
      checkpoint('profile')
      for (const file of compatibility) atomicWrite(file.path, file.data)
      atomicWrite(target, patched)
      checkpoint('archive')
      if (sha(target) !== record.installedSha256) throw new Error('Installed archive checksum failed')
      for (const file of compatibility) if (sha(file.path) !== hash(file.data)) throw new Error('Installed compatibility checksum failed')
      // Keep restore independent of the extracted ZIP and its location.
      cpSync(join(bundle, 'installer.cjs'), join(state, 'installer.cjs'))
      cpSync(join(bundle, 'install.ps1'), join(state, 'install.ps1'))
      writeFileSync(join(state, 'latest.json'), JSON.stringify({ backup }, null, 2) + '\n')
      return { version: manifest.pluginVersion, backup, state }
    } catch (error) {
      try { restore(backup, { locked: true }) } catch (rollback) { throw new AggregateError([error, rollback], `Installation failed and rollback failed. Backup: ${backup}`) }
      throw error
    }
  } finally { rmSync(staging, { recursive: true, force: true }); rmSync(lockPath, { force: true }) }
}

export function restore(backup, { locked = false } = {}) {
  backup = resolve(backup)
  const record = json(join(backup, 'restore.json'))
  if (record.schema !== 2 || record.pluginName !== PLUGIN) throw new Error('Use restore-native.ps1 for legacy backup records')
  const archive = join(backup, 'app.asar')
  if (!locked && sha(join(record.appDirectory, 'resources/app.asar')) !== record.installedSha256) throw new Error('Current DSH archive changed since installation; refusing to overwrite it')
  for (const [path, expected] of Object.entries(record.pluginHashes ?? {})) if (sha(join(backup, 'plugin', path)) !== expected) throw new Error('Plugin backup checksum failed')
  if (sha(archive) !== record.originalSha256) throw new Error('Archive backup checksum failed')
  for (const file of record.files) if (file.exists && sha(join(backup, file.stored)) !== file.sha256) throw new Error(`Backup checksum failed: ${file.stored}`)
  const state = dirname(dirname(backup))
  const lockPath = join(state, 'installer.lock')
  if (!locked) writeFileSync(lockPath, String(process.pid), { flag: 'wx' })
  try {
    atomicWrite(join(record.appDirectory, 'resources/app.asar'), readFileSync(archive))
    for (const file of record.files) {
      if (file.exists) atomicWrite(file.path, readFileSync(join(backup, file.stored)))
      else rmSync(file.path, { force: true })
    }
    const plugin = join(record.profileDirectory, 'node_modules', PLUGIN)
    rmSync(plugin, { recursive: true, force: true })
    if (record.pluginExists) {
      if (record.pluginLink) symlinkSync(record.pluginLink, plugin, process.platform === 'win32' ? 'junction' : 'dir')
      else cpSync(join(backup, 'plugin'), plugin, { recursive: true, filter: () => true })
    }
    return { backup }
  } finally { if (!locked) rmSync(lockPath, { force: true }) }
}
