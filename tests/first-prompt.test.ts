import assert from 'node:assert/strict'
import test from 'node:test'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createAndSendProjectlessSession, type PromptAcceptance } from '../src/client/first-prompt.ts'
import { createProjectlessRegistry, type ProjectlessSessionHost } from '../src/client/session.ts'
import type { DiagnosticEvent, DiagnosticFields } from '../src/shared/diagnostics.ts'

function scenario(acceptance: PromptAcceptance = 'accepted') {
  const operations: string[] = []
  const events: { event: DiagnosticEvent, fields: DiagnosticFields }[] = []
  const errors: unknown[] = []
  const sessionId = 'session-1' as SessionId
  const workspaceId = 'workspace-1' as WorkspaceId
  const input = Object.freeze({ text: 'PRIVATE prompt', attachments: ['PRIVATE file'], route: { provider: 'provider-1', model: 'model-1' } })
  const prepared = { title: 'SQLite建表', source: 'provider' }
  const pending = new Set<WorkspaceId>()
  const host: ProjectlessSessionHost = {
    async create({ path }): Promise<WorkspaceView> {
      operations.push('register')
      return { workspaceId, path, title: '', sessionIds: [], createdAt: '', updatedAt: '' }
    },
    async connectWorkspace() { operations.push('create-session'); return sessionId },
    async delete() { operations.push('detach') },
    async archiveSession() { operations.push('archive') },
  }
  const sessions = {
    open() { operations.push('open') },
    list: { getSnapshot: () => ({ byId: { [sessionId]: { blank: true } } }), subscribe: () => () => {} },
  }
  const services = {
    async prepareTitle(actual: typeof input) { assert.equal(actual, input); operations.push('title'); return prepared },
    async provisionDirectory(title: string) { assert.equal(title, prepared.title); operations.push('directory'); return '/root/2026-09-30/SQLite建表' },
    async bindPreparedTitle(id: SessionId, title: typeof prepared) { assert.equal(id, sessionId); assert.equal(title, prepared); operations.push('bind-title') },
    async send(id: SessionId, actual: typeof input): Promise<PromptAcceptance> { assert.equal(id, sessionId); assert.equal(actual, input); operations.push('send'); return acceptance },
    async removeDirectory() { operations.push('remove-directory') },
    isCurrentTarget: () => true,
    onError(error: unknown) { errors.push(error) },
  }
  const run = () => createAndSendProjectlessSession(host, sessions, input, services, createProjectlessRegistry(), pending,
    (event, fields = {}) => { events.push({ event, fields }) })
  return { host, sessions, services, run, operations, events, errors, pending, workspaceId, input }
}

test('prepares title before directory, binds it once, sends once, then detaches and opens', async () => {
  const fixture = scenario()
  assert.equal((await fixture.run()).acceptance, 'accepted')
  assert.deepEqual(fixture.operations, ['title', 'directory', 'register', 'create-session', 'bind-title', 'send', 'detach', 'open'])
  assert.equal(fixture.pending.size, 0)
  assert.equal(JSON.stringify(fixture.events).includes('PRIVATE'), false)
})

test('cancellation after title does not allocate a directory or create resources', async () => {
  const fixture = scenario()
  const controller = new AbortController()
  const services = { ...fixture.services, signal: controller.signal,
    async prepareTitle(input: typeof fixture.input) {
      const title = await fixture.services.prepareTitle(input)
      controller.abort(new Error('cancelled during preparation'))
      return title
    },
  }
  await assert.rejects(createAndSendProjectlessSession(fixture.host, fixture.sessions, fixture.input,
    services, createProjectlessRegistry(), fixture.pending), /cancelled during preparation/)
  assert.deepEqual(fixture.operations, ['title'])
})

test('cancellation after allocation removes only the newly allocated unused directory', async () => {
  const fixture = scenario()
  const controller = new AbortController()
  const services = { ...fixture.services, signal: controller.signal,
    async provisionDirectory(title: string) {
      const path = await fixture.services.provisionDirectory(title)
      controller.abort(new Error('cancelled after allocation'))
      return path
    },
  }
  await assert.rejects(createAndSendProjectlessSession(fixture.host, fixture.sessions, fixture.input,
    services, createProjectlessRegistry(), fixture.pending), /cancelled after allocation/)
  assert.deepEqual(fixture.operations, ['title', 'directory', 'remove-directory'])
})

test('background preparation finishes without taking the current view', async () => {
  const fixture = scenario()
  fixture.services.isCurrentTarget = () => false
  assert.equal((await fixture.run()).acceptance, 'accepted')
  assert.equal(fixture.operations.includes('send'), true)
  assert.equal(fixture.operations.includes('open'), false)
})

test('native creation receives the prepared identity instead of opening an unrelated blank Session', async () => {
  const fixture = scenario()
  const services = { ...fixture.services, async createSession(workspaceId: WorkspaceId, title: { title: string }) {
    assert.equal(workspaceId, fixture.workspaceId)
    assert.equal(title.title, 'SQLite建表')
    fixture.operations.push('native-create')
    return 'session-1' as SessionId
  } }
  const result = await createAndSendProjectlessSession(fixture.host, fixture.sessions, fixture.input,
    services, createProjectlessRegistry(), fixture.pending)
  assert.equal(result.acceptance, 'accepted')
  assert.equal(fixture.operations.includes('create-session'), false)
  assert.equal(fixture.operations.includes('native-create'), true)
})

test('workspace registration failure removes its newly allocated directory without creating a Session', async () => {
  const fixture = scenario()
  fixture.host.create = async () => { throw new Error('registration denied') }
  await assert.rejects(fixture.run(), /registration denied/)
  assert.deepEqual(fixture.operations, ['title', 'directory', 'remove-directory'])
  assert.equal(fixture.pending.size, 0)
})

test('explicit rejection archives and rolls back; unknown admission retains resources and sweep guard', async () => {
  const rejected = scenario('rejected')
  assert.equal((await rejected.run()).acceptance, 'rejected')
  assert.deepEqual(rejected.operations.slice(-3), ['archive', 'detach', 'remove-directory'])
  assert.equal(rejected.pending.size, 0)
  const unknown = scenario('unknown')
  assert.equal((await unknown.run()).acceptance, 'unknown')
  assert.equal(unknown.operations.includes('detach'), false)
  assert.equal(unknown.operations.includes('remove-directory'), false)
  assert.equal(unknown.pending.has(unknown.workspaceId), true)
})

test('a thrown send is unknown admission, never grounds for directory removal or automatic resend', async () => {
  const fixture = scenario()
  fixture.services.send = async () => { throw new Error('connection lost') }
  assert.equal((await fixture.run()).acceptance, 'unknown')
  assert.equal(fixture.errors.length, 1)
  assert.equal(fixture.operations.includes('detach'), false)
  assert.equal(fixture.pending.size, 1)
})

test('binding failure rolls back an unused session before the first prompt', async () => {
  const fixture = scenario()
  fixture.services.bindPreparedTitle = async () => { throw new Error('native bind failed') }
  await assert.rejects(fixture.run(), /native bind failed/)
  assert.equal(fixture.operations.includes('send'), false)
  assert.deepEqual(fixture.operations.slice(-3), ['archive', 'detach', 'remove-directory'])
  assert.equal(fixture.pending.size, 0)
})

test('detach failure after admission preserves success and never removes output or repeats sending', async () => {
  const fixture = scenario()
  fixture.host.delete = async () => { throw new Error('unregister failed') }
  const result = await fixture.run()
  assert.equal(result.acceptance, 'accepted')
  assert.equal(result.detachmentPending, true)
  assert.equal(fixture.pending.has(fixture.workspaceId), true)
  assert.equal(fixture.errors.length, 1)
  assert.equal(fixture.operations.includes('remove-directory'), false)
  assert.equal(fixture.operations.filter(op => op === 'send').length, 1)
})

test('a UI opening failure cannot change an accepted prompt into an unknown or rejected prompt', async () => {
  const fixture = scenario()
  fixture.sessions.open = () => { throw new Error('view disposed') }
  assert.equal((await fixture.run()).acceptance, 'accepted')
  assert.equal(fixture.errors.length, 1)
})

test('failed workspace rollback never removes a directory still referenced by the workspace', async () => {
  const fixture = scenario('rejected')
  fixture.host.delete = async () => { throw new Error('unregister failed') }
  assert.equal((await fixture.run()).acceptance, 'rejected')
  assert.equal(fixture.operations.includes('remove-directory'), false)
  assert.equal(fixture.errors.length, 1)
})
