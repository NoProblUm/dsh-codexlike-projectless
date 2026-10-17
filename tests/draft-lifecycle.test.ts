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
  const rows: Record<string, { blank: boolean, retainedBy: Record<string, number> }> = {
    'native-restored': { blank: true, retainedBy: { mainView: 1 } },
    'history-a': { blank: false, retainedBy: {} },
    'history-none': { blank: false, retainedBy: {} },
  }
  const projects = [{ workspaceId: 'a', sessionIds: ['native-restored', 'history-a'] }]
  let current = 'native-restored'
  let next = 0
  const initializations = new Map<string, unknown>()
  const presets = new Map<string, unknown>()
  const snapshot = () => ({ phase: 'ready', ids: Object.keys(rows), byId: rows })
  const publish = () => { for (const listener of listeners) listener() }
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const sessions = {
    list: { getSnapshot: snapshot, subscribe },
    createProjectlessDraft() {
      const id = `projectless-draft-${++next}`
      rows[id] = { blank: true, retainedBy: {} }
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
    uiWorkspace: { openSession: open },
    conversation: { input: { requestDraftInitialization(binding: { id: string }, options: unknown) { initializations.set(binding.id, options); return 'applied' } } }, connection: { rpc: {} },
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
    assert.notEqual(current, first, 'explicit new never reuses cached editor')
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
    assert.equal(next, count + 2, 'two explicit requests retain separate operation identities')
    assert.deepEqual(initializations.get(`projectless-draft-${count + 1}`), one)
    assert.deepEqual(initializations.get(`projectless-draft-${count + 2}`), two)
    assert.equal(presets.get(`projectless-draft-${count + 1}`), 'one')
    assert.equal(presets.get(`projectless-draft-${count + 2}`), 'two')
    rows[`projectless-draft-${count + 2}`]!.blank = false
    open('history-a')
    await drafts.restore()
    assert.equal(current, `projectless-draft-${count + 1}`, 'sidebar falls back to the latest remaining unsent editor')
    assert.equal(next, count + 2, 'restoring an older unsent editor creates no new resource')
    assert.deepEqual(errors, [])
  } finally {
    for (const dispose of disposers.reverse()) dispose()
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
