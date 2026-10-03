import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRootSettings } from '../src/host/settings.ts'
import { createProjectlessRuntime, dispatchProjectlessEndpoint } from '../src/index.ts'

test('root override persists, failed validation keeps previous setting, and configured root stays authorized', async () => {
  const area = await mkdtemp(join(tmpdir(), 'projectless-settings-'))
  try {
    const file = join(area, 'settings.json')
    const initial = join(area, 'initial')
    const next = join(area, 'next')
    const settings = createRootSettings(initial, file)
    assert.equal(await settings.get(), initial)
    await settings.save(next)
    assert.equal(await settings.get(), next)
    assert.equal(await createRootSettings(initial, file).get(), next)
    await assert.rejects(settings.save('relative'), /absolute path/)
    const blocked = join(area, 'file')
    await writeFile(blocked, 'existing file')
    await assert.rejects(settings.save(blocked))
    assert.equal(await settings.get(), next)
    assert.equal(JSON.parse(await readFile(file, 'utf8')).root, next)
    assert.equal(await settings.accepts(initial), true)
    assert.equal(await settings.accepts(join(area, 'unapproved')), false)
  } finally { await rm(area, { recursive: true, force: true }) }
})

test('first send pins root across a setting change and rollback uses the original ownership root', async () => {
  const area = await mkdtemp(join(tmpdir(), 'projectless-settings-'))
  try {
    const initial = join(area, 'initial')
    const next = join(area, 'next')
    const runtime = createProjectlessRuntime()
    runtime.settings = createRootSettings(initial, join(area, 'settings.json'))
    const saved = await dispatchProjectlessEndpoint(initial, 'save-root', { path: next }, runtime)
    assert.equal(saved.ok, true)
    const created = await dispatchProjectlessEndpoint(initial, 'create-directory', { title: 'Pinned', root: initial }, runtime)
    assert.equal(created.ok, true)
    const path = (created as { value: { path: string } }).value.path
    assert.equal(path.startsWith(initial), true)
    assert.equal((await stat(path)).isDirectory(), true)
    const removed = await dispatchProjectlessEndpoint(initial, 'remove-directory', { path }, runtime)
    assert.equal(removed.ok, true)
    await assert.rejects(stat(path))
    const unknown = await dispatchProjectlessEndpoint(initial, 'create-directory', { root: join(area, 'unapproved') }, runtime)
    assert.equal(unknown.ok, false)
  } finally { await rm(area, { recursive: true, force: true }) }
})

test('first send accepts the canonical root returned by get-root with Windows slash and case differences', async () => {
  const area = await mkdtemp(join(tmpdir(), 'projectless-root-'))
  try {
    const initial = process.platform === 'win32' ? area.replace(/\\/g, '/').toLowerCase() : area + '/'
    for (const useSettings of [false, true]) {
      const runtime = createProjectlessRuntime()
      if (useSettings) runtime.settings = createRootSettings(initial, join(area, 'settings.json'))
      const settings = await dispatchProjectlessEndpoint(initial, 'get-root', {}, runtime)
      assert.equal(settings.ok, true)
      const root = (settings as { value: { root: string } }).value.root
      const created = await dispatchProjectlessEndpoint(initial, 'create-directory', { title: 'First send', root }, runtime)
      assert.equal(created.ok, true, JSON.stringify(created))
      const path = (created as { value: { path: string } }).value.path
      assert.equal((await stat(path)).isDirectory(), true)
      assert.equal((await dispatchProjectlessEndpoint(initial, 'remove-directory', { path }, runtime)).ok, true)
      assert.equal((await dispatchProjectlessEndpoint(initial, 'create-directory', { root: join(area, 'unknown') }, runtime)).ok, false)
    }
  } finally { await rm(area, { recursive: true, force: true }) }
})
