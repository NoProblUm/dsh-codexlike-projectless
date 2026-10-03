import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { openAsar } from './asar.mjs'
import { rewriteArchive } from './installer/archive.mjs'
import { patches } from '../native/patches.mjs'

const original = resolve(process.argv[2] ?? 'E:/DeepSeekHarness/resources/app.asar')
const output = resolve(process.argv[3] ?? 'native/staged/app.asar')
const archive = openAsar(original)
const replacements = new Map()
const plugin = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
const manifest = { targetVersion: '0.2.0-rc.2', pluginName: plugin.name, pluginVersion: plugin.version, original, output, originalSha256: '', outputSha256: '', entries: [] }
const hash = data => createHash('sha256').update(data).digest('hex')
for (const [path, patch] of Object.entries(patches)) {
  const entry = 'dsh/node_modules/@deepseek-ai/' + path
  const before = archive.read(entry)
  const after = Buffer.from(patch(before.toString('utf8')))
  transformSync(after.toString(), { loader: 'js' })
  replacements.set(entry, after)
  manifest.entries.push({ entry, before: hash(before), after: hash(after) })
}
const complete = rewriteArchive(archive, replacements)
archive.close()
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, complete)
manifest.originalSha256 = hash(readFileSync(original))
manifest.outputSha256 = hash(complete)
writeFileSync(resolve(output, '../manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ output, size: complete.length, entries: manifest.entries.length, sha256: manifest.outputSha256 }, null, 2))
