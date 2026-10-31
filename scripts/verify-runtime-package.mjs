import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const [archive, version, report, installed] = process.argv.slice(2)
if (!archive || !version || !report) throw new Error('Usage: node scripts/verify-runtime-package.mjs <tgz> <expected-version> <report.json> [installed-package]')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
// Python emits ASCII JSON, avoiding the Windows tar CLI's locale-dependent names.
const entries = JSON.parse(execFileSync('python', ['-c', 'import tarfile,json,base64,sys\nwith tarfile.open(sys.argv[1]) as t:\n m=t.getmembers()\n assert all(x.isfile() for x in m)\n assert len(m)==len(set(x.name for x in m))\n print(json.dumps({x.name:base64.b64encode(t.extractfile(x).read()).decode("ascii") for x in m}))', archive], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }))
const names = Object.keys(entries)
const read = name => Buffer.from(entries['package/' + name], 'base64')
const required = ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','licenses/git-graph-Apache-2.0.txt','package.json','cordis.patch.yml','README.md','README.zh-CN.md','CHANGELOG.md','lib/index.js','lib/client.js','lib/index.js.map','lib/client.js.map','lib/index.d.ts']
if (version === '1.3.0') required.push('docs/1.3.0-验收报告.md')
assert.deepEqual(names.slice().sort(), required.map(name => 'package/' + name).sort(), 'Unexpected or missing package files')
const manifest = JSON.parse(read('package.json'))
assert.equal(manifest.version, version)
assert.equal(manifest.engines.dsh, '0.2.1-rc.5')
assert.match(read('LICENSE').toString(), /MIT License/)
assert.match(read('licenses/git-graph-Apache-2.0.txt').toString(), /Apache License/)
assert.match(read('THIRD_PARTY_NOTICES.md').toString(), /Apache-2.0/)
const files = required.map(path => {
  const bytes = read(path)
  const result = { path, bytes: bytes.length, sha256: hash(bytes) }
  if (installed && ['lib/index.js','lib/client.js','package.json'].includes(path)) {
    assert.ok(bytes.equals(readFileSync(join(installed, path))), 'Installed bytes differ: ' + path)
    result.installedMatches = true
  }
  return result
})
const result = { passed: true, version, archive, bytes: readFileSync(archive).length, sha256: hash(readFileSync(archive)), files, installed: installed ?? null }
writeFileSync(report, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ passed: true, version, sha256: result.sha256, files: files.length, installed: !!installed }))
