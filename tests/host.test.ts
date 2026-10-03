import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply, createProjectlessFetch, createProjectlessRuntime } from '../src/index.ts'

function clientRequest(method: string, payload: unknown, rpcId = 'rpc-1'): Request {
  return new Request('http://dsh.internal/api/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
  })
}

test('answers the Connection client-request envelope with a server-response', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-projectless-host-'))
  try {
    const response = await createProjectlessFetch(root, 'create-directory')(
      clientRequest('dsh-codexlike-projectless/create-directory', {}, 'rpc-create'),
    )
    const body = await response.json() as { type: string, rpcId: string, result: { ok: boolean, value: { path: string } } }
    assert.equal(body.type, 'server-response')
    assert.equal(body.rpcId, 'rpc-create')
    assert.equal(body.result.ok, true)
    assert.equal(body.result.value.path.startsWith(root), true)
    assert.equal((await stat(body.result.value.path)).isDirectory(), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects a mismatched method and a missing remove-directory path', async () => {
  const root = '/tmp/dsh-projectless-host-unused'
  const mismatched = await (await createProjectlessFetch(root, 'get-root')(
    clientRequest('dsh-codexlike-projectless/create-directory', {}),
  )).json() as { result: { ok: boolean, error: { code: string } } }
  assert.equal(mismatched.result.ok, false)
  assert.equal(mismatched.result.error.code, 'bad-request')

  const missing = await (await createProjectlessFetch(root, 'remove-directory')(
    clientRequest('dsh-codexlike-projectless/remove-directory', {}),
  )).json() as { result: { ok: boolean, error: { message: string } } }
  assert.equal(missing.result.ok, false)
  assert.match(missing.result.error.message, /requires \{ path \}/)

  const wrongType = await createProjectlessFetch(root, 'get-root')(new Request('http://dsh.internal/api/x', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  }))
  assert.equal(wrongType.status, 415)
})

test('registers one exact /api Fetch route per endpoint', () => {
  const routes: { path: string, methods: readonly string[] }[] = []
  const ctx = {
    effect(execute: () => unknown) { execute() },
    connection: {
      fetch: {
        register(route: { path: string, methods: readonly string[] }) {
          routes.push(route)
          return async () => {}
        },
      },
    },
  }
  apply(ctx as never, { root: '/tmp/dsh-projectless-host-unused' })
  assert.deepEqual(routes.map(route => route.path), [
    '/api/dsh-codexlike-projectless/create-directory',
    '/api/dsh-codexlike-projectless/get-root',
    '/api/dsh-codexlike-projectless/remove-directory',
    '/api/dsh-codexlike-projectless/log-event',
    '/api/dsh-codexlike-projectless/prepare-title',
    '/api/dsh-codexlike-projectless/bind-title',
    '/api/dsh-codexlike-projectless/save-root',
  ])
  assert.deepEqual(routes.map(route => route.methods), Array.from({ length: 7 }, () => ['POST']))
})

test('topic RPC shares live ownership with remove RPC, but ownership is not inferred after restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-projectless-host-'))
  try {
    const events: string[] = []
    const runtime = createProjectlessRuntime(event => { events.push(event) }, true)
    const created = await (await createProjectlessFetch(root, 'create-directory', runtime)(
      clientRequest('dsh-codexlike-projectless/create-directory', { title: 'SQLite建表', untitled: '未命名' }),
    )).json() as { result: { ok: boolean, value: { path: string } } }
    assert.equal(created.result.ok, true)
    const path = created.result.value.path
    assert.equal(path.endsWith('SQLite建表'), true)
    const afterRestart = await (await createProjectlessFetch(root, 'remove-directory', createProjectlessRuntime())(
      clientRequest('dsh-codexlike-projectless/remove-directory', { path }),
    )).json() as { result: { ok: boolean } }
    assert.equal(afterRestart.result.ok, false)
    assert.equal((await stat(path)).isDirectory(), true)
    const removed = await (await createProjectlessFetch(root, 'remove-directory', runtime)(
      clientRequest('dsh-codexlike-projectless/remove-directory', { path }),
    )).json() as { result: { ok: boolean, value: { result: string } } }
    assert.equal(removed.result.value.result, 'removed')
    assert.equal(runtime.ownedDirectories.size, 0)
    assert.equal(events.includes('directory.created'), true)
    assert.equal(events.includes('directory.removed'), true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('validates title payloads and accepts metadata-only diagnostic events', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-projectless-host-'))
  try {
    const entries: unknown[] = []
    const runtime = createProjectlessRuntime((event, fields) => { entries.push({ event, fields }) }, true)
    const invalid = await (await createProjectlessFetch(root, 'create-directory', runtime)(
      clientRequest('dsh-codexlike-projectless/create-directory', { title: { text: 'invalid' } }),
    )).json() as { result: { ok: boolean, error: { code: string } } }
    assert.equal(invalid.result.error.code, 'bad-request')
    const logged = await (await createProjectlessFetch(root, 'log-event', runtime)(
      clientRequest('dsh-codexlike-projectless/log-event', { event: 'prompt.accepted', fields: { sessionId: 'session-1', prompt: 'PRIVATE' } }),
    )).json() as { result: { ok: boolean, value: { accepted: boolean } } }
    assert.equal(logged.result.value.accepted, true)
    assert.deepEqual(entries.at(-1), { event: 'prompt.accepted', fields: { sessionId: 'session-1' } })
    assert.equal(JSON.stringify(entries).includes('PRIVATE'), false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
