import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { installSessionDispatch } from '../src/client/session-dispatch.ts'
const fixture = JSON.parse(readFileSync(new URL('./fixtures/git-graph-0.4.6.json', import.meta.url), 'utf8'))
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
for (const order of ['graph-first', 'projectless-first']) for (const isolate of [false, true]) {
  test(`${order}: local bypass and project options remain operation-local, isolation=${isolate}`, async () => {
    const calls: unknown[][] = [], local: unknown[][] = []
    let gitCalls = 0
    const registry = { list: { getSnapshot: () => ({ items: [{ workspaceId: 'a', path: '/repo-a', sessionIds: ['history-a'] }, { workspaceId: 'b', path: '/repo-b', sessionIds: [] }] }) },
      async create({ path }: { path: string }) { return { workspaceId: path } } }
    class Navigation {
      mainReference = { sessionId: 'history-none' }
      workspaces = registry
      startSession(id?: string, options?: unknown) { const workspace = this.workspaces.list.getSnapshot(); void workspace; calls.push([id, options]) }
    }
    const navigation = new Navigation()
    const native = navigation.startSession
    const git = { async config() { gitCalls++; await tick(); return { ok: true, value: { autoIsolate: isolate, worktreesHome: '/wt' } } }, async status() { return { ok: true, value: {} } },
      async addWorktree(path: string) { return { ok: true, value: { path: path + '/wt' } } } }
    let original: any
    const enableGraph = () => {
      original = navigation.startSession
      navigation.startSession = runInNewContext(fixture.declaration + '\nrouted', { original, navigation, registry, git, routing: new Set(), resolveTarget: (id?: string) => id ?? 'a', TAG: 'test' })
    }
    if (order === 'graph-first') enableGraph()
    const dispatch = installSessionDispatch(navigation, registry, git, (id, options) => {
      if (id === undefined && navigation.mainReference.sessionId === 'history-none') { local.push([options]); return true }
      return false
    })
    if (order === 'projectless-first') enableGraph()
    const one = { prompt: 'one', clearPreviousDraft: true, agentPreset: 'first' }
    const two = { prompt: 'two', clearPreviousDraft: false, agentPreset: 'second' }
    navigation.startSession(undefined, one)
    assert.equal(local.length, 1)
    assert.equal(gitCalls, 0)
    navigation.startSession('a', one)
    navigation.startSession('b', two)
    await tick(); await tick(); await tick()
    assert.deepEqual(calls, [[isolate ? '/repo-a/wt' : 'a', one], [isolate ? '/repo-b/wt' : 'b', two]])
    assert.equal(gitCalls, 2)
    navigation.startSession = original // Git Graph disposal
    navigation.startSession('a', two)
    assert.deepEqual(calls.at(-1), ['a', two])
    dispatch.dispose()
    assert.equal(navigation.startSession, native)
  })
}

test('disposing and reactivating preserves a live Graph and its later restore without recursion', async () => {
  const { Context } = await import('@deepseek-ai/cordis')
  const ctx = new Context()
  const calls: unknown[][] = []
  const registry = { list: { getSnapshot: () => ({ items: [] }) }, async create() {} }
  class Navigation {
    workspaces = registry
    startSession(id?: string, options?: unknown) { const workspace = this.workspaces.list.getSnapshot(); void workspace; calls.push([id, options]) }
  }
  const nav = new Navigation()
  ctx.provide('uiWorkspace', nav)
  const face = (ctx as any).uiWorkspace
  const git = { async config() { return { ok: true, value: { autoIsolate: false } } } }
  const install = () => installSessionDispatch(nav, registry, git, () => false)
  let plugin = install()
  const captured = face.startSession
  const routed = runInNewContext(fixture.declaration+'\nrouted', { original: captured, navigation: face, registry, git, routing: new Set(), resolveTarget: (id: string) => id, TAG: 'test' })
  face.startSession = routed
  plugin.dispose()
  face.startSession('a')
  await tick()
  assert.equal(calls.length, 1)
  plugin = install()
  face.startSession('b', { prompt: 'second activation' })
  await tick()
  assert.deepEqual(calls.at(-1), ['b', { prompt: 'second activation' }])
  face.startSession = captured
  plugin.dispose()
  plugin = install()
  face.startSession('c', { prompt: 'third activation' })
  assert.deepEqual(calls.at(-1), ['c', { prompt: 'third activation' }])
  plugin.dispose()
})

test('a stale Graph disposer leaves a later Graph installation enabled', async () => {
  const calls: unknown[][] = []
  let configs = 0
  const registry = { list: { getSnapshot: () => ({ items: [] }) }, async create() {} }
  class Navigation { workspaces=registry; startSession(id?: string, options?: unknown) { const workspace=this.workspaces.list.getSnapshot(); void workspace; calls.push([id, options]) } }
  const nav=new Navigation()
  const git={ async config(){configs++; return {ok:true,value:{autoIsolate:false}}} }
  const plugin=installSessionDispatch(nav,registry,git,()=>false)
  const enable=()=>{const original=nav.startSession;nav.startSession=runInNewContext(fixture.declaration+'\nrouted',{original,navigation:nav,registry,git,routing:new Set(),resolveTarget:(id:string)=>id,TAG:'test'});return ()=>{nav.startSession=original}}
  const first=enable(),second=enable()
  first()
  nav.startSession('a')
  await tick()
  assert.equal(configs,1,'later Graph must still receive the request')
  plugin.dispose()
  nav.startSession('b')
  await tick()
  assert.equal(calls.length,2,'disposed plugin must leave the later Graph callable')
  second()
  nav.startSession('c')
  assert.deepEqual(calls.at(-1),['c',undefined])
})

test('unverified package versions never enter Git or native creation', async () => {
  let nativeCalls=0,gitCalls=0
  const registry={list:{getSnapshot:()=>({items:[]})},async create(){}}
  class Navigation {workspaces=registry;startSession(){const workspace=this.workspaces.list.getSnapshot();void workspace;nativeCalls++}}
  const nav=new Navigation(),errors:string[]=[]
  const git={async config(){gitCalls++;return {ok:true,value:{autoIsolate:false}}}}
  const plugin=installSessionDispatch(nav,registry,git,()=>false,{async version(){throw new Error('unsupported version')},conflict(reason){errors.push(reason)}})
  const original=nav.startSession
  nav.startSession=runInNewContext(fixture.declaration+'\nrouted',{original,navigation:nav,registry,git,routing:new Set(),resolveTarget:(id:string)=>id,TAG:'test'})
  await (nav.startSession as any)('a')
  assert.deepEqual(errors,['Error: unsupported version'])
  assert.equal(nativeCalls,0)
  assert.equal(gitCalls,0)
  plugin.dispose()
})

test('Graph-first disposal through real Cordis service faces restores native project initialization', async () => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const ctx = new Context(),calls:unknown[][]=[]
  const registry={list:{getSnapshot:()=>({items:[]})},async create(){}}
  class Navigation extends Service {constructor(){super(ctx,'uiWorkspace')}workspaces=registry;startSession(id?:string,options?:unknown){const workspace=this.workspaces.list.getSnapshot();void workspace;calls.push([id,options])}}
  const nav=new Navigation()
  const face=(ctx as any).uiWorkspace,original=face.startSession
  const git={async config(){return {ok:true,value:{autoIsolate:false}}}}
  face.startSession=runInNewContext(fixture.declaration+'\nrouted',{original,navigation:face,registry,git,routing:new Set(),resolveTarget:(id:string)=>id,TAG:'test'})
  const plugin=installSessionDispatch(nav,registry,git,()=>false)
  face.startSession=original
  face.startSession('a',{prompt:'native after Graph disabled'})
  assert.deepEqual(calls,[['a',{prompt:'native after Graph disabled'}]])
  plugin.dispose()
})

test('Plugin-first disposal through real Cordis Service faces restores native project initialization', async () => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const ctx = new Context(),calls:unknown[][]=[]
  const registry={list:{getSnapshot:()=>({items:[]})},async create(){}}
  class Navigation extends Service {constructor(){super(ctx,'uiWorkspace')}workspaces=registry;startSession(id?:string,options?:unknown){const workspace=this.workspaces.list.getSnapshot();void workspace;calls.push([id,options])}}
  const nav=new Navigation()
  const face=(ctx as any).uiWorkspace
  const git={async config(){return {ok:true,value:{autoIsolate:false}}}}
  const plugin=installSessionDispatch(nav,registry,git,()=>false)
  const original=face.startSession
  face.startSession=runInNewContext(fixture.declaration+'\nrouted',{original,navigation:face,registry,git,routing:new Set(),resolveTarget:(id:string)=>id,TAG:'test'})
  face.startSession=original
  face.startSession('a',{prompt:'native after Graph disabled'})
  assert.deepEqual(calls,[['a',{prompt:'native after Graph disabled'}]])
  plugin.dispose()
})
