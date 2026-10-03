import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm, rmdir, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { createTopicDirectory, removeUnusedProjectlessDirectory, topicDirectoryName } from '../src/host/directories.ts'

const now = new Date(2026, 8, 30, 10)

test('sanitizes topic filenames without introducing another title algorithm', () => {
  assert.equal(topicDirectoryName('SQLite建表'), 'SQLite建表')
  assert.equal(topicDirectoryName('../CON: /建表?. '), '.._CON_ _建表_')
  assert.equal(topicDirectoryName('CON.txt'), '_CON.txt')
  assert.equal(topicDirectoryName('LPT¹'), '_LPT¹')
  assert.equal(topicDirectoryName('... ', '未命名'), '未命名')
  assert.equal(topicDirectoryName('\0\r\n'), '___')
  const long = topicDirectoryName('中'.repeat(150), '未命名', '_12')
  assert.ok(Buffer.byteLength(long) <= 240)
  assert.equal(long.endsWith('_12'), true)
  assert.equal(long.includes('\ufffd'), false)
})

test('atomically allocates parallel same-day topics and never adopts an existing file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-topics-'))
  try {
    await mkdir(join(root, '2026-09-30'))
    await writeFile(join(root, '2026-09-30', 'SQLite建表'), 'user file')
    const paths = await Promise.all(Array.from({ length: 8 }, () => createTopicDirectory(root, 'SQLite建表', '未命名', now)))
    assert.equal(new Set(paths).size, 8)
    assert.deepEqual(paths.map(path => basename(path)).sort(), Array.from({ length: 8 }, (_, i) => `SQLite建表_${i + 2}`).sort())
    for (const path of paths) assert.equal((await stat(path)).isDirectory(), true)
    const tomorrow = await createTopicDirectory(root, 'SQLite建表', '未命名', new Date(2026, 9, 1))
    assert.equal(tomorrow, join(root, '2026-10-01', 'SQLite建表'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('only this process owns named directories; user output and unowned lookalikes are retained', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-topics-'))
  try {
    const path = await createTopicDirectory(root, 'SQLite建表', '未命名', now)
    const canonical = await realpath(path)
    const owned = new Map([[path, canonical], [canonical, canonical]])
    await assert.rejects(removeUnusedProjectlessDirectory(root, path), /not a projectless/)
    await writeFile(join(path, 'output.sql'), 'select 1;')
    assert.equal(await removeUnusedProjectlessDirectory(root, path, owned), 'retained')
    const empty = await createTopicDirectory(root, '空目录', '未命名', now)
    const emptyCanonical = await realpath(empty)
    owned.set(empty, emptyCanonical)
    owned.set(emptyCanonical, emptyCanonical)
    assert.equal(await removeUnusedProjectlessDirectory(root, empty, owned), 'removed')
    assert.equal((await stat(path)).isDirectory(), true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('does not create a topic through a redirected date directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-topic-links-'))
  try {
    const outside = join(root, 'outside')
    const configured = join(root, 'configured')
    await mkdir(outside)
    await mkdir(configured)
    await symlink(outside, join(configured, '2026-09-30'), process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(createTopicDirectory(configured, 'SQLite建表', '未命名', now), /not a projectless/)
    await assert.rejects(stat(join(outside, 'SQLite建表')), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('does not follow a replaced owned directory into another owned directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-topic-links-'))
  try {
    const first = await createTopicDirectory(root, 'first', '未命名', now)
    const second = await createTopicDirectory(root, 'second', '未命名', now)
    const owned = new Map([[first, await realpath(first)], [second, await realpath(second)]])
    await rmdir(first)
    await symlink(second, first, process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(removeUnusedProjectlessDirectory(root, first, owned), /not a projectless/)
    assert.equal((await stat(second)).isDirectory(), true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('an unowned legacy-shaped link cannot inherit ownership of a topic directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-topic-links-'))
  try {
    const topic = await createTopicDirectory(root, 'SQLite建表', '未命名', now)
    const canonical = await realpath(topic)
    const owned = new Map([[topic, canonical], [canonical, canonical]])
    const link = join(root, '2026-09-30', 'session-10-00-00-aabbccdd')
    await symlink(topic, link, process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(removeUnusedProjectlessDirectory(root, link, owned), /not a projectless/)
    assert.equal((await stat(topic)).isDirectory(), true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
