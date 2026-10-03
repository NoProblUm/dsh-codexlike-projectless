import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const path = resolve(process.env.USERPROFILE, '.dsh/profiles/desktop/node_modules/dsh-better-sidebar/lib/client.js')
const source = readFileSync(path, 'utf8')
const before = 'if (sessionId === void 0 || summaryCwd !== void 0) return;'
const after = 'if (sessionId === void 0 || summaryCwd !== void 0 || ctx.sessions.isProjectlessDraft?.(sessionId)) return;'
if ((source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before))
  && (source.indexOf(after) < 0 || source.indexOf(after) !== source.lastIndexOf(after))) throw new Error('Unsupported better-sidebar compatibility anchor')
const patched = source.includes(after) ? source : source.replace(before, after)
const staged = resolve('native/staged/better-sidebar-client.js')
writeFileSync(staged, patched)
const hash = data => createHash('sha256').update(data).digest('hex')
const manifestPath = resolve('native/staged/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath))
manifest.sidebarCompat = { path, staged, originalSha256: hash(source), outputSha256: hash(patched) }
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
