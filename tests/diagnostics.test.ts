import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createDiagnosticLogger } from '../src/host/diagnostics.ts'
import { diagnosticPayload } from '../src/shared/diagnostics.ts'

test('writes ordered JSONL diagnostics and flushes them for test inspection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-log-'))
  try {
    const file = join(root, '.projectless-session.log')
    const logger = createDiagnosticLogger(file, true)
    logger.emit('directory.created', { path: '/workspace/topic' })
    logger.emit('workspace.registered', { workspaceId: 'workspace-1' })
    logger.emit('workspace.detached', { sessionId: 'session-1', workspaceId: 'workspace-1' })
    await logger.flush()
    const lines = (await readFile(file, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(lines.map(line => line.sequence), [1, 2, 3])
    assert.deepEqual(lines.map(line => line.event), ['directory.created', 'workspace.registered', 'workspace.detached'])
    assert.ok(lines.every(line => !Number.isNaN(Date.parse(line.time))))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('disabled diagnostics create no directory or file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-log-'))
  try {
    const file = join(root, 'unused', 'log')
    const logger = createDiagnosticLogger(file, false)
    logger.emit('directory.created')
    await logger.flush()
    await assert.rejects(stat(join(root, 'unused')), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('logging failure is reported once, never rejects operations or flush', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-log-'))
  try {
    const blocker = join(root, 'file')
    await writeFile(blocker, 'not a directory')
    const errors: unknown[] = []
    const logger = createDiagnosticLogger(join(blocker, 'log'), true, error => { errors.push(error) })
    logger.emit('directory.created')
    logger.emit('workspace.registered')
    await logger.flush()
    logger.emit('workspace.detached')
    await logger.flush()
    assert.equal(errors.length, 1)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('client log schema strips arbitrary prompt, attachment and credential fields', () => {
  const parsed = diagnosticPayload({ event: 'prompt.accepted', fields: {
    sessionId: 'session-1', prompt: 'PRIVATE PROMPT', apiKey: 'PRIVATE KEY', attachment: 'PRIVATE FILE',
  } })
  assert.deepEqual(parsed, { event: 'prompt.accepted', fields: { sessionId: 'session-1' } })
  assert.equal(diagnosticPayload({ event: 'arbitrary-event', fields: {} }), undefined)
  assert.equal(diagnosticPayload({ event: 'prompt.accepted', fields: { sessionId: 42 } }), undefined)
})
