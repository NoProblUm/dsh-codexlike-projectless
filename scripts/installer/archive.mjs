import { createHash } from 'node:crypto'
const hash = data => createHash('sha256').update(data).digest('hex')

export function rewriteArchive(archive, replacements) {
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
return complete
}
