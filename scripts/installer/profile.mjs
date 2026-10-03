import { parseDocument, isSeq, isMap } from 'yaml'
export const PLUGIN = 'dsh-codexlike-projectless'

function document(text, label) {
  const doc = parseDocument(text)
  if (doc.errors.length) throw new Error(`Invalid ${label}: ${doc.errors[0].message}`)
  return doc
}

// Edit parsed YAML nodes to preserve comments and all unrelated settings.
export function updateProfile(packageText, configText, lockText, packageDirectory) {
  const pkg = JSON.parse(packageText)
  if (pkg.dependencies && (typeof pkg.dependencies !== 'object' || Array.isArray(pkg.dependencies))) throw new Error('Invalid profile dependencies')
  pkg.dependencies ??= {}
  const spec = 'link:' + packageDirectory.replaceAll('\\', '/')
  pkg.dependencies[PLUGIN] = spec
  const config = document(configText, 'cordis.patch.yml')
  if (!isSeq(config.contents)) throw new Error('Expected a sequence in cordis.patch.yml')
  const entries = config.contents.items.filter(item => isMap(item) && (item.get('id') === PLUGIN || item.get('name') === PLUGIN))
  if (entries.length > 1) throw new Error('Multiple projectless plugin entries; resolve duplicates before installation')
  for (const item of config.contents.items) {
    if (isMap(item) && (item.get('id') === 'dsh-projectless-session' || item.get('name') === 'dsh-projectless-session') && item.get('disabled') !== true) {
      throw new Error('Disable dsh-projectless-session before installation')
    }
  }
  if (entries.length) entries[0].set('disabled', false)
  else config.contents.add({ id: PLUGIN, name: PLUGIN })
  let lock
  if (lockText !== undefined) {
    lock = document(lockText, 'pnpm-lock.yaml')
    if (!isMap(lock.contents) || !['9.0', '6.0'].includes(String(lock.get('lockfileVersion')))) throw new Error('Unsupported pnpm lockfile version')
    if (!isMap(lock.getIn(['importers', '.']))) throw new Error('Missing root pnpm importer')
    lock.setIn(['importers', '.', 'dependencies', PLUGIN], { specifier: spec, version: spec })
  }
  return { package: JSON.stringify(pkg, null, 2) + '\n', config: config.toString(), lock: lock?.toString() }
}
