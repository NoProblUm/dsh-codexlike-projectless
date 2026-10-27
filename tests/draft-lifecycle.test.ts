import assert from 'node:assert/strict'
import test from 'node:test'
import { installProjectlessDrafts } from '../src/client/draft.ts'
import { SELECTION_KEY } from '../src/client/selection.ts'

test('global new inherits current project; projectless stays local and explicit workspace delegates', async () => {
  const storage = new Map([[SELECTION_KEY, JSON.stringify({ kind: 'projectless' })]])
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
  } })
  const listeners = new Set<() => void>()
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const disposers: (() => void)[] = []
  const rows: Record<string, { blank: boolean, retainedBy: Record<string, number>, projectionValues?: { agentPreset?: string } }> = {
    'native-restored': { blank: true, retainedBy: { mainView: 1 } },
    'history-a': { blank: false, retainedBy: {} },
    'history-none': { blank: false, retainedBy: {} },
  }
  const projects = [{ workspaceId: 'a', sessionIds: ['native-restored', 'history-a'] }]
  let current = 'native-restored'
  let next = 0
  const initializations = new Map<string, unknown[]>()
  const presets = new Map<string, unknown>()
  const snapshot = () => ({ phase: 'ready', ids: Object.keys(rows), byId: rows })
  const publish = () => { for (const listener of listeners) listener() }
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const sessions = {
    list: { getSnapshot: snapshot, subscribe },
    createProjectlessDraft(values: { agentPreset?: string }) {
      const id = `projectless-draft-${++next}`
      rows[id] = { blank: true, retainedBy: {}, projectionValues: values.agentPreset === undefined ? {} : { agentPreset: values.agentPreset } }
      return id
    },
    discardProjectlessDraft(id: string) { delete rows[id] },
    updateProjectlessDraft(id: string, key: string, value: unknown) { if (key === 'agentPreset') presets.set(id, value) },
    async create({ workspaceId }: { workspaceId: string }) {
      const id = `project-draft-${++next}`
      rows[id] = { blank: true, retainedBy: {} }
      projects.find(project => project.workspaceId === workspaceId)?.sessionIds.push(id)
      return id
    },
    retain(id: string) {
      rows[id]!.retainedBy.controllerOperation = (rows[id]!.retainedBy.controllerOperation ?? 0) + 1
      return { ready: Promise.resolve({ id }), release() { if (rows[id]) rows[id]!.retainedBy.controllerOperation = (rows[id]!.retainedBy.controllerOperation ?? 1) - 1 } }
    },
  }
  const open = (id: string) => {
    rows[current]!.retainedBy.mainView = 0
    current = id
    rows[id]!.retainedBy.mainView = 1
    publish()
  }
  const success = (value: unknown) => Promise.resolve({ ok: true, value })
  const ctx = {
    sessions,
    workspaces: { list: { getSnapshot: () => ({ phase: 'ready', items: projects }), subscribe } },
    uiWorkspace: { openSession: open, async openWorkspace(workspaceId: string) { const id = await sessions.create({ workspaceId }); open(id) } },
    conversation: { input: { requestDraftInitialization(binding: { id: string }, options: unknown) { initializations.set(binding.id, [...initializations.get(binding.id) ?? [], options]); return 'applied' } } }, connection: { rpc: {} },
    remote: {
      session: { modelCatalog: () => success({ default: { provider: 'fixture', model: 'test' }, routableProviders: ['fixture'], groups: [{ id: 'fixture', models: [{ id: 'test' }] }] }) },
      agentPresets: { list: () => success({ presets: [] }) },
      permissionPresets: { catalog: () => success({ defaultPreset: 'edit' }) },
    },
    on(name: string, handler: (...args: unknown[]) => unknown) { handlers.set(name, handler) },
    effect(effect: () => (() => void)) { disposers.push(effect()) },
  }
  const flush = () => new Promise<void>(resolve => setImmediate(resolve))
  const errors: unknown[] = []
  try {
    const drafts = installProjectlessDrafts(ctx as never, {} as never, new Set(), () => {}, error => { errors.push(error) }, {
      admission: () => undefined, beginFirstSend() {},
    })
    await flush()
    assert.match(current, /^projectless-draft-/)
    assert.deepEqual(JSON.parse(storage.get(SELECTION_KEY)!), { kind: 'projectless' })
    const first = current
    assert.equal(await drafts.start(), first, 'repeat no project restores the same editor')
    await drafts.switchWorkspace('a' as never)
    const a = current
    await drafts.start()
    assert.equal(current, first)
    await drafts.switchWorkspace('a' as never)
    assert.equal(current, a)
    open('history-none')
    drafts.select('a' as never)
    // A native navigation can publish the previous retention before the new one.
    // The bridge supplies the actual main reference instead of that stale row.
    rows['history-a']!.retainedBy.mainView = 1
    handlers.get('projectless/new-session')!(undefined, 'history-none')
    rows['history-a']!.retainedBy.mainView = 0
    await flush()
    assert.match(current, /^projectless-draft-/)
    assert.equal(current, first, 'ordinary new restores the existing editor')
    open('history-a')
    const membership = [...projects[0]!.sessionIds]
    const history = structuredClone(rows['history-a'])
    await drafts.start()
    assert.match(current, /^projectless-draft-/)
    assert.deepEqual(projects[0]!.sessionIds, membership, 'switching never changes historical project membership')
    assert.equal(rows['history-a']!.blank, history!.blank)
    open('history-a')
    const recent = await drafts.restore()
    assert.equal(current, recent, 'sidebar restores latest local editor from project history')
    assert.equal(await drafts.restore(), recent, 'repeat sidebar activation keeps the editor')
    open('history-a')
    const globalOptions = { prompt: 'project prompt', clearPreviousDraft: true, agentPreset: 'standard' }
    assert.equal(handlers.get('projectless/new-session')!(undefined, 'history-a', globalOptions), undefined,
      'global new from a project must delegate to native navigation instead of selecting ungrouped')
    await flush()
    assert.equal(current, 'history-a', 'local draft handler must leave project creation to native navigation')
    const beforeExplicit = current
    assert.equal(handlers.get('projectless/new-session')!('a'), undefined)
    await flush()
    assert.equal(current, beforeExplicit, 'native workspace flow remains responsible for explicit requests')
    open('history-none')
    const count = next
    const one = { prompt: 'one', clearPreviousDraft: true, agentPreset: 'one' }
    const two = { prompt: 'two', clearPreviousDraft: false, agentPreset: 'two' }
    handlers.get('projectless/new-session')!(undefined, 'history-none', one)
    handlers.get('projectless/new-session')!(undefined, 'history-none', two)
    await flush()
    assert.equal(next, count, 'an unlisted preset remains eligible for both concurrent requests')
    assert.deepEqual(initializations.get(first), [one, two], 'each request is applied in arrival order')
    rows[first]!.projectionValues = { agentPreset: 'one' }
    handlers.get('projectless/new-session')!(undefined, 'history-none', two)
    await flush()
    assert.equal(next, count + 1, 'a listed different preset requires a new draft')
    const second = current
    assert.equal(rows[second]?.projectionValues?.agentPreset, 'two')
    const same = { prompt: 'three', whenDraftExists: 'append', agentPreset: 'two' }
    handlers.get('projectless/new-session')!(undefined, 'history-none', same)
    await flush()
    assert.equal(next, count + 1, 'matching preset reuses the most recent draft')
    assert.deepEqual(initializations.get(second), [two, same])
    rows[second]!.blank = false
    open('history-a')
    await drafts.restore()
    assert.equal(current, first, 'sidebar falls back to the latest remaining unsent editor')
    assert.equal(next, count + 1, 'restoring an older unsent editor creates no new resource')
    assert.deepEqual(errors, [])
  } finally {
    for (const dispose of disposers.reverse()) dispose()
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})


test('concurrent requests during first draft creation share one draft and keep their own ordered options', async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {} } })
  const handlers = new Map<string, (...args: any[]) => any>()
  const disposers: (() => void)[] = []
  const rows: Record<string, any> = {}
  let current: string | undefined
  let creates = 0
  let releaseCatalog!: () => void
  const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
  const applied: unknown[] = []
  const snapshot = () => ({ phase: 'ready', ids: Object.keys(rows), byId: rows })
  const sessions = {
    list: { getSnapshot: snapshot, subscribe: () => () => {} },
    createProjectlessDraft() { creates++; rows.draft = { blank: true, retainedBy: {}, projectionValues: {} }; return 'draft' },
    retain() { return { ready: Promise.resolve({ id: 'draft' }), release() {} } },
    discardProjectlessDraft() {},
  }
  const ok = (value: unknown) => ({ ok: true, value })
  const ctx = {
    sessions,
    workspaces: { list: { getSnapshot: () => ({ phase: 'ready', items: [], archivedSessionIds: [] }), subscribe: () => () => {} } },
    uiWorkspace: { openSession(id: string) { current = id; rows[id].retainedBy.mainView = 1 } },
    conversation: { input: { requestDraftInitialization(_binding: unknown, options: unknown) { applied.push(options); return 'applied' } } },
    connection: { rpc: {} },
    remote: {
      session: { async modelCatalog() { await catalogGate; return ok({ default: { provider: 'fixture', model: 'test' }, routableProviders: ['fixture'], groups: [{ id: 'fixture', models: [{ id: 'test' }] }] }) } },
      agentPresets: { async list() { return ok({ presets: [] }) } },
      permissionPresets: { async catalog() { return ok({ defaultPreset: 'edit' }) } },
    },
    on(name: string, handler: (...args: any[]) => any) { handlers.set(name, handler) },
    effect(effect: () => () => void) { disposers.push(effect()) },
  }
  const errors: unknown[] = []
  try {
    installProjectlessDrafts(ctx as never, {} as never, new Set(), () => {}, error => errors.push(error), { admission: () => undefined, beginFirstSend() {} })
    const first = { prompt: 'first', whenDraftExists: 'append' }
    const second = { prompt: 'second', whenDraftExists: 'replace' }
    assert.equal(handlers.get('projectless/new-session')!(undefined, undefined, first), true)
    assert.equal(handlers.get('projectless/new-session')!(undefined, undefined, second), true)
    await new Promise<void>(resolve => setImmediate(resolve))
    assert.equal(creates, 0)
    releaseCatalog()
    await new Promise<void>(resolve => setImmediate(resolve))
    assert.equal(creates, 1)
    assert.equal(current, 'draft')
    assert.deepEqual(applied, [first, second])
    assert.deepEqual(errors, [])
  } finally {
    for (const dispose of disposers.reverse()) dispose()
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
