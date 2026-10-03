import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { openAsar } from './asar.mjs'
import { patches } from '../native/patches.mjs'

const original = resolve(process.argv[2] ?? 'E:/DeepSeekHarness/resources/app.asar')
const output = resolve(process.argv[3] ?? 'native/staged/app.asar')
const archive = openAsar(original)
const replacements = new Map()
const manifest = { targetVersion: '0.2.0-rc.2', pluginVersion: JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version, original, output, originalSha256: '', outputSha256: '', entries: [] }
const hash = data => createHash('sha256').update(data).digest('hex')
for (const [path, patch] of Object.entries(patches)) {
  const entry = 'dsh/node_modules/@deepseek-ai/' + path
  const before = archive.read(entry)
  const after = Buffer.from(patch(before.toString('utf8')))
  transformSync(after.toString(), { loader: 'js' })
  replacements.set(entry, after)
  manifest.entries.push({ entry, before: hash(before), after: hash(after) })
}
const buffers = []
let offset = 0
function walk(tree, prefix = '') {
  for (const [name, entry] of Object.entries(tree.files ?? {})) {
    const path = prefix + name
    if (entry.files) { walk(entry, path + '/'); continue }
    if (entry.unpacked || entry.link) continue
    const data = replacements.get(path) ?? archive.read(path)
    entry.offset = String(offset)
    entry.size = data.length
    if (replacements.has(path) && entry.integrity) {
      const size = entry.integrity.blockSize
      entry.integrity.hash = hash(data)
      entry.integrity.blocks = []
      for (let start = 0; start < data.length; start += size) entry.integrity.blocks.push(hash(data.subarray(start, start + size)))
    }
    buffers.push(data)
    offset += data.length
  }
}
// Read every original payload before rewriting its shared header offsets.
// The reader uses the original entry offsets, so build a detached header.
const header = structuredClone(archive.tree)
walk(header)
const json = Buffer.from(JSON.stringify(header))
const pickle = Buffer.alloc(8 + Math.ceil(json.length / 4) * 4)
pickle.writeUInt32LE(pickle.length - 4, 0)
pickle.writeUInt32LE(json.length, 4)
json.copy(pickle, 8)
const size = Buffer.alloc(8)
size.writeUInt32LE(4, 0)
size.writeUInt32LE(pickle.length, 4)
const complete = Buffer.concat([size, pickle, ...buffers])
archive.close()
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, complete)
manifest.originalSha256 = hash(readFileSync(original))
manifest.outputSha256 = hash(complete)
writeFileSync(resolve(output, '../manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ output, size: complete.length, entries: manifest.entries.length, sha256: manifest.outputSha256 }, null, 2))
