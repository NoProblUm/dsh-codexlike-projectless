import assert from 'node:assert/strict'
import { cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const [sourceArg, targetArg] = process.argv.slice(2)
if (!sourceArg || !targetArg) throw new Error('Usage: node scripts/clone-acceptance-profile.mjs <stopped-source> <new-target>')
const source = resolve(sourceArg), target = resolve(targetArg), output = resolve('output')
for (const path of [source, target]) assert.ok(relative(output, path).startsWith('runtime-candidate-') && !relative(output, path).includes('..'), 'Only isolated acceptance roots are allowed')
const processRecord = JSON.parse(readFileSync(join(source, 'process.json')))
let alive = false
try { process.kill(processRecord.desktopPid, 0); alive = true } catch {}
assert.equal(alive, false, 'Source Desktop must have exited normally')
mkdirSync(target)
cpSync(source, target, { recursive: true, dereference: true })
for (const file of ['home/profiles/desktop/cordis.patch.yml', 'home/storages/dsh-codexlike-projectless-settings.json', 'home/profiles/desktop/node_modules/.modules.yaml', 'home/profiles/desktop/node_modules/.pnpm-workspace-state-v1.json']) {
  const text = readFileSync(join(target, file), 'utf8').replaceAll(JSON.stringify(source).slice(1, -1), JSON.stringify(target).slice(1, -1)).replaceAll(source, target).replaceAll(source.replaceAll('\\', '/'), target.replaceAll('\\', '/'))
  writeFileSync(join(target, file), text)
}
writeFileSync(join(target, 'clone.json'), JSON.stringify({ source, target, copiedAt: new Date().toISOString(), historicalPathsPreserved: true }, null, 2))
console.log(JSON.stringify({ source, target }))
