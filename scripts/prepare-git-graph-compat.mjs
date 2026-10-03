import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { patchGitGraph } from '../native/git-graph-compat.mjs'

const profile = resolve(process.argv[2] ?? resolve(process.env.USERPROFILE, '.dsh/profiles/desktop'))
const directory = resolve(profile, 'node_modules/@linxin666/dsh-client-ui-git-graph')
const path = resolve(directory, 'lib/client.js')
const { version } = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
const source = readFileSync(path, 'utf8')
const manifestPath = resolve('native/staged/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.targetVersion !== '0.2.0-rc.2') throw new Error('Unsupported DSH compatibility target')
const patched = patchGitGraph(source, version)
transformSync(patched, { loader: 'js' })
const staged = resolve('native/staged/git-graph-client.js')
const hash = data => createHash('sha256').update(data).digest('hex')
writeFileSync(staged, patched)
manifest.gitGraphCompat = { path, staged, version, originalSha256: hash(source), outputSha256: hash(patched) }
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(manifest.gitGraphCompat, null, 2))
