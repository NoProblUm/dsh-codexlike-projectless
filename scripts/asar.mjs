import { openSync, readSync, closeSync } from 'node:fs'

/** Read an Electron ASAR entry without changing the installed application. */
export function openAsar(path) {
  const fd = openSync(path, 'r')
  const prefix = Buffer.alloc(16)
  readSync(fd, prefix, 0, prefix.length, 0)
  const header = Buffer.alloc(prefix.readUInt32LE(12))
  readSync(fd, header, 0, header.length, 16)
  const tree = JSON.parse(header.toString('utf8'))
  const dataOffset = 8 + prefix.readUInt32LE(4)
  return {
    tree,
    read(name) {
      let entry = tree
      for (const part of name.split('/')) entry = entry.files?.[part]
      if (!entry || entry.files || entry.unpacked || entry.link) throw new Error(`Unsupported ASAR entry: ${name}`)
      const data = Buffer.alloc(entry.size)
      readSync(fd, data, 0, data.length, dataOffset + Number(entry.offset))
      return data
    },
    close() { closeSync(fd) },
  }
}
