import { originalInstance } from '../shared/runtime.ts'
import { bindGraph046, graph046Source } from './git-graph-046.ts'

const compact = (source: string) => source.replace(/\s/g, '')
const isGraph = (method: Function) => compact(Function.prototype.toString.call(method)) === compact(graph046Source)
const isNative = (method: Function) => compact(Function.prototype.toString.call(method)).includes('constworkspace=this.workspaces.list.getSnapshot()')
const TERMINAL = Symbol.for('dsh-codexlike-projectless.session-terminal')
const NATIVE = Symbol.for('dsh-codexlike-projectless.native-start-session')

/** Same document-relative JSON transport as Git Graph 0.4.6's GitApi. */
export function gitGraphTransport() {
  const post = async (endpoint: string, payload: object) => {
    try {
      const response = await fetch(`git/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      return await response.json()
    } catch { return { ok: false, error: { code: 'internal', message: 'git route unavailable' } } }
  }
  return {
    config: () => post('config', {}),
    status: (path: string) => post('status', { path }),
    addWorktree: (path: string, name: string, baseRef?: string) => post('worktree-add', { path, name, ...baseRef === undefined ? {} : { baseRef } }),
    removeWorktree: (path: string, worktreePath: string, opts: { force?: boolean } = {}) => post('worktree-remove', { path, worktreePath, force: opts.force === true, deleteBranch: false }),
  }
}

/** Rebind the pinned Git Graph route with a terminal closure for each request. */
export function installSessionDispatch(target: any, registry: any, git: any,
  local: (workspaceId: string | undefined, options: any) => boolean,
  verification?: { version(): Promise<void>, conflict(reason: string): void }) {
  target = originalInstance(target)
  const descriptor = Object.getOwnPropertyDescriptor(target, 'startSession')
  const installed = target.startSession
  if (typeof installed !== 'function') throw new Error('startSession 新建入口不可用')
  const initial = installed[TERMINAL]?.inactive() ? installed[TERMINAL].native : installed[NATIVE] ?? installed
  const native = isNative(initial) ? initial : Object.getPrototypeOf(target).startSession
  if (typeof native !== 'function' || !isNative(native)) throw new Error('原生新建会话边界不匹配')
  if (initial !== native && !isGraph(initial)) throw new Error('startSession 被未知包装接管；仅验证 Git Graph 0.4.6 的完整路由指纹')
  if (descriptor && !descriptor.configurable) throw new Error('startSession 属性不可配置')
  if (typeof registry.list?.getSnapshot !== 'function' || typeof registry.create !== 'function') throw new Error('Git Graph Workspace 能力不匹配')
  // A Cordis Service method face is an apply-only Proxy without cordis.original.
  // Symbol reads still reach its exact native function, including faces captured
  // by Git Graph before this adapter was installed.
  if (native[NATIVE] !== native) Object.defineProperty(native, NATIVE, { value: native, configurable: true })
  let active = true
  let route = initial
  const faces = new WeakSet<Function>()
  const layers: { method: Function, restore: Function, enabled: boolean }[] = initial === native ? [] : [{ method: initial, restore: native, enabled: true }]
  let lastFace: Function = native
  const routing = new Set<string>()
  const restoreProperty = () => {
    if (Object.getOwnPropertyDescriptor(target, 'startSession')?.get !== getter) return
    if (descriptor && initial === native) Object.defineProperty(target, 'startSession', descriptor)
    else delete target.startSession
  }
  const getter = () => {
    if (!active) return route
    const predecessor = route
    const face = function(this: any, workspaceId?: string, options?: any) {
      if (!active) {
        const index = layers.findIndex(item => item.method === predecessor)
        const delegate = index < 0 ? predecessor : layers.slice(0, index + 1).findLast(item => item.enabled)?.method ?? native
        return delegate.call(target, workspaceId, options)
      }
      if (local(workspaceId, options)) return
      if (route === native) return native.call(target, workspaceId, options)
      // Every async continuation closes over this call's own options, including
      // the final worktree id. No shared next-initialization slot is used.
      const run = () => bindGraph046((id?: string) => native.call(target, id, options), target, registry, git, routing,
        id => id ?? registry.list.getSnapshot().items.find((item: any) => item.sessionIds.includes(target.mainReference?.sessionId))?.workspaceId
          ?? registry.list.getSnapshot().items[0]?.workspaceId)(workspaceId)
      if (!verification) return run()
      return verification.version().then(() => active ? run() : native.call(target, workspaceId, options))
        .catch(error => verification.conflict(String(error)))
    }
    Object.defineProperty(face, TERMINAL, { value: { native, face, inactive: () => !active } })
    faces.add(face)
    lastFace = face
    return face
  }
  const setter = (method: any) => {
    method = method?.[NATIVE] === native ? native : method?.[TERMINAL]?.face ?? originalInstance(method)
    const restoring = method?.[TERMINAL]?.native === native && method[TERMINAL].inactive() ? native : method
    const layer = layers.find(item => item.enabled && item.restore === method)
      ?? layers.find(item => item.enabled && item.restore === restoring)
    if (layer) {
      layer.enabled = false
      route = layers.findLast(item => item.enabled)?.method ?? native
      if (!active && route === native) restoreProperty()
      return
    }
    if (faces.has(method) || restoring === native) return
    if (typeof method !== 'function' || !isGraph(method)) {
      if (!active) { Object.defineProperty(target, 'startSession', { configurable: true, writable: true, value: method }); return }
      throw new Error('拒绝未知 startSession 接管；仅支持已验证的 Git Graph 0.4.6 路由')
    }
    layers.push({ method, restore: lastFace, enabled: true })
    route = method
  }
  Object.defineProperty(target, 'startSession', { configurable: true, enumerable: descriptor?.enumerable ?? false, get: getter, set: setter })
  return {
    owns: () => Object.getOwnPropertyDescriptor(target, 'startSession')?.get === getter,
    dispose() {
      if (!active) return
      active = false
      if (Object.getOwnPropertyDescriptor(target, 'startSession')?.get !== getter) return
      // Keep the inert descriptor until known third-party layers are released:
      // an older disposer must not overwrite a newer plugin's live entry.
      if (route === native) restoreProperty()
    },
  }
}
