import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { openAsar } from './asar.mjs'

const oldRoot = resolve('../dsh-projectless-session-main')
const evidence = resolve('../rc5-evidence-20261031')
const out = resolve('output/rc5-baseline-20261031')
mkdirSync(out, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const archivePath = join(evidence, 'app/resources/app.asar')
const archive = openAsar(archivePath)
const old = openAsar(join(oldRoot, 'output/rc3-isolated-20261027/app/resources/app.asar'))
try {
  const identity = JSON.parse(archive.read('package.json'))
  assert.equal(identity.version, '0.2.1-rc.5')
  assert.equal(identity.dshBuildDirty, false)
  assert.match(identity.dshBuildCommit, /^[a-f0-9]{40}$/)
  const original = readFileSync('src/host/runtime.ts', 'utf8')
  const paths = [...original.matchAll(/'([^']+\/lib\/[^']+\.js)': '[a-f0-9]{64}'/g)].map(item => item[1])
  assert.equal(paths.length, 7)
  const modules = paths.map(path => {
    const full = 'dsh/node_modules/@deepseek-ai/' + path
    const before = old.read(full), after = archive.read(full)
    const beforeHash = hash(before), afterHash = hash(after)
    mkdirSync(join(out, 'modules', path, '..'), { recursive: true })
    writeFileSync(join(out, 'modules', path), after)
    return { path, before: beforeHash, after: afterHash, changed: beforeHash !== afterHash }
  })
  const installer = readFileSync(join(evidence, 'deepseek-harness-0.2.1-rc.5-win-x64.exe'))
  const feed = readFileSync(join(evidence, 'official-nightly.yml'), 'utf8')
  const sha512 = createHash('sha512').update(installer).digest('base64')
  assert.ok(feed.includes(sha512))
  assert.ok(feed.includes(String(installer.length)))
  const related = execFileSync('git', ['ls-files', 'src', 'tests', 'scripts', 'package.json', 'package-lock.json'], { encoding: 'utf8' }).trim().split('\n')
  const differences = []
  for (const path of related) {
    const current = readFileSync(path)
    for (const [label, root] of [['working', oldRoot], ['releasePreparation', join(oldRoot, 'output/release-1.2.0-preparation/source')]]) {
      try { const previous = readFileSync(join(root, path)); if (hash(current) !== hash(previous)) differences.push({ path, source: label, baseline: hash(current), compared: hash(previous), equalIgnoringCRLF: current.toString().replaceAll('\r\n', '\n') === previous.toString().replaceAll('\r\n', '\n') }) }
      catch (error) { if (error.code !== 'ENOENT') throw error; differences.push({ path, source: label, missing: true }) }
    }
  }
  const manifest = { recordedAt: new Date().toISOString(), sourceTag: 'v1.2.0', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tagVerifiedVia: 'https://api.github.com/repos/NoProblUm/dsh-codexlike-projectless/git/ref/tags/v1.2.0', feedUrl: 'https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml', installerUrl: 'https://download.deepseek.com/dsh-desk/bin/win-x64/deepseek-harness-0.2.1-rc.5-win-x64.exe', installer: { bytes: installer.length, sha256: hash(installer), sha512, matchesOfficialFeed: true }, archive: { path: archivePath, sha256: hash(readFileSync(archivePath)) }, identity, modules, sourceDifferences: differences }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ identity, archive: manifest.archive, modules, differences }, null, 2))
} finally { archive.close(); old.close() }
