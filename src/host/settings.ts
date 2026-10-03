import { mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Host-owned override; configuration remains the initial fallback. */
export function createRootSettings(initialRoot: string, file: string) {
  let root = initialRoot
  const roots = new Set([initialRoot])
  const ready = readFile(file, 'utf8').then(text => {
    const saved = JSON.parse(text) as { root?: unknown }
    if (typeof saved.root !== 'string' || !isAbsolute(saved.root)) throw new Error('Invalid saved projectless root')
    root = saved.root
    roots.add(root)
  }).catch(error => { if (error.code !== 'ENOENT') throw error })
  let saving = Promise.resolve()
  return {
    async get() { await ready; return root },
    async accepts(candidate: string) {
      await ready
      if (!isAbsolute(candidate)) return false
      const canonical = await realpath(candidate).catch(() => resolve(candidate))
      for (const known of roots) {
        if (canonical === await realpath(known).catch(() => resolve(known))) return true
      }
      return false
    },
    save(candidate: string): Promise<string> {
      const operation = saving.then(async () => {
        await ready
        if (!isAbsolute(candidate)) throw new Error('projectless session root must be an absolute path')
        await mkdir(candidate, { recursive: true })
        const canonical = await realpath(candidate)
        const probe = join(canonical, `.projectless-write-${randomUUID()}`)
        try { await writeFile(probe, '', { flag: 'wx' }) } finally { await unlink(probe).catch(error => { if (error.code !== 'ENOENT') throw error }) }
        await mkdir(dirname(file), { recursive: true })
        const temporary = `${file}.${randomUUID()}.tmp`
        try {
          await writeFile(temporary, JSON.stringify({ root: canonical }) + '\n', { flag: 'wx' })
          await rename(temporary, file)
        } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error }) }
        root = canonical
        roots.add(root)
        return root
      })
      saving = operation.then(() => {}, () => {})
      return operation
    },
  }
}
