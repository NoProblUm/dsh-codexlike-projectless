import { createPortal } from 'react-dom'
import { IconCloseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { createElement, Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { ADAPTER_ID, RUNTIME_PACKAGE_VERSION, TARGET_BUILD, RUNTIME_WRAPPER, originalInstance, wrapRuntimeMethod, type RuntimeStatus } from '../shared/runtime.ts'
import { decodeSelection, SELECTION_KEY } from './selection.ts'
import { matchesNativeSubmission, type NativeAdmission } from './admission.ts'
import { installSessionDispatch, gitGraphTransport } from './session-dispatch.ts'

interface ClientRuntime {
  getStatus(): RuntimeStatus
  subscribeStatus(listener: () => void): () => void
  confirm(host: RuntimeStatus): boolean
  admission(sessionId: string): NativeAdmission | undefined
  beginFirstSend(sessionId: string): void
  fail(reason: string): void
  dispose(): void
}
const installations = new WeakMap<object, ClientRuntime>()
let activationGeneration = 0

/** All access to rc.2 implementation fields is confined to this adapter. */
export function activateClientRuntime(ctx: Context): ClientRuntime {
  const key = originalInstance(ctx.sessions)
  const existing = installations.get(key)
  if (existing) return existing
  const generation = ++activationGeneration
  const status: RuntimeStatus = { state: 'checking', reason: '正在检查运行时兼容性', adapter: ADAPTER_ID, version: RUNTIME_PACKAGE_VERSION, build: TARGET_BUILD, missingCapabilities: [] }
  const listeners = new Set<() => void>()
  const disposers: (() => void)[] = []
  const ownership: (() => boolean)[] = []
  const drafts = new Map<string, { summary: any, values: Record<string, unknown> }>()
  const retiredIds = new Set<string>()
  const localFiles = new Map<string, string>()
  const submissions = new Map<string, { requestId?: string, accepted: boolean, observed: boolean, errorCode?: string }>()
  let active = true
  let business = false
  let restored = false
  const sessions = originalInstance(ctx.sessions) as any
  const manager = originalInstance(sessions.manager) as any
  const navigation = originalInstance(ctx.uiWorkspace) as any
  const conversation = originalInstance(ctx.conversation) as any
  const gateway = originalInstance(ctx.remote) as any
  const core = originalInstance((ctx.slots as any)._core) as any
  const isDraft = (id: unknown): id is string => typeof id === 'string' && drafts.has(id)
  const isLocal = (id: unknown) => typeof id === 'string' && (drafts.has(id) || retiredIds.has(id))
  const updateStatus = (state: RuntimeStatus['state'], reason: string) => {
    Object.assign(status, { state, reason, missingCapabilities: state === 'ready' ? [] : [reason] })
    for (const listener of listeners) listener()
  }
  const requireActive = () => {
    if (active && business && ownership.some(check => !check())) { business = false; updateStatus('conflict', '关键运行时方法已被覆盖，请停用冲突功能后正常重启') }
    if (!active || !business || status.state !== 'ready') throw new Error(status.reason)
  }
  const wrap = (target: any, key: string, fn: Parameters<typeof wrapRuntimeMethod>[2]) => {
    target = originalInstance(target)
    const restore = wrapRuntimeMethod(target, key, fn)
    const installed = target[key]
    const check = () => target[key] === installed
    let released = false
    const release = () => {
      if (released) return
      released = true
      const index = disposers.indexOf(release)
      if (index >= 0) disposers.splice(index, 1)
      const ownerIndex = ownership.indexOf(check)
      if (ownerIndex >= 0) ownership.splice(ownerIndex, 1)
      restore()
    }
    disposers.push(release)
    ownership.push(check)
    return release
  }
  const deny = () => ({ ok: false, error: { code: 'projectless/draft-only', message: '此操作需要真实会话，草稿身份不会发送到宿主。', details: {} } })
  const localIdentity = (value: unknown): boolean => isLocal(value)
    || typeof value === 'object' && value !== null && Object.values(value).some(localIdentity)
  try {
    if (sessions.createProjectlessDraft || /projectless\/new-session/.test(Function.prototype.toString.call(navigation.startSession))) throw new Error('检测到旧归档补丁；请先明确恢复原版后再启用')
    if (!core || typeof core.factory !== 'function' || !conversation.input) throw new Error('原生视图或输入服务不匹配')
    wrap(navigation, 'restoreSelection', (original, receiver, args) => {
      restored = true
      const saved = receiver.selection.getSnapshot()
      const history = args[1].byId[saved.sessionId]
      const choice = decodeSelection(localStorage.getItem(SELECTION_KEY))
      // Valid native history (including a subagent address) takes precedence.
      if (active && !saved.subagentAddress && (!history || history.blank) && choice.kind === 'projectless') return Promise.resolve()
      if (active && !saved.subagentAddress && (!history || history.blank) && choice.kind === 'project' && args[0].items.some((item: any) => item.workspaceId === choice.workspaceId)) return receiver.openWorkspace(choice.workspaceId)
      return original.apply(receiver, args)
    })
    const dispatch = installSessionDispatch(navigation, originalInstance(ctx.workspaces), gitGraphTransport(), (workspaceId, options) => {
      if (!active || !business) return false
      requireActive()
      return ctx.bail('projectless/new-session', workspaceId as any, navigation.mainReference?.sessionId, options) === true
    }, {
      async version() {
        const service = (ctx as any).get('remote.pluginManager')
        if (!service) throw new Error('无法读取 Git Graph 插件版本，拒绝未验证组合')
        const result = await service.listBundles()
        if (!result.ok) throw new Error('无法确认 Git Graph 版本：' + result.error.message)
        const graph = result.value.find((item: any) => item.name === '@linxin666/dsh-client-ui-git-graph')
        if (!graph?.enabled || graph.version !== '0.4.6') throw new Error('仅验证 Git Graph 0.4.6；当前版本：' + (graph?.version ?? '未知'))
      },
      conflict(reason) { business = false; updateStatus('conflict', reason) },
    })
    disposers.push(dispatch.dispose)
    ownership.push(dispatch.owns)
    wrap(navigation, 'openWorkspace', (original, receiver, args) => {
      if (active && business && args[1] !== undefined && args[2] === undefined && isDraft(receiver.mainReference?.sessionId)) {
        requireActive()
        const result = ctx.bail('projectless/select-workspace', args[0])
        if (result !== undefined) return result
      }
      return original.apply(receiver, args)
    })
  } catch (error) {
    for (const dispose of disposers.splice(0).reverse()) dispose()
    active = false
    updateStatus('conflict', String(error))
  }
  try {
    if (!active) throw new Error(status.reason)
    wrap(manager, 'buildListSnapshot', (original, receiver, args) => {
      if (active) for (const item of drafts.values()) if (!receiver.summaries.some((row: any) => row.sessionId === item.summary.sessionId)) receiver.summaries.push(item.summary)
      return original.apply(receiver, args)
    })
    wrap(manager, 'refreshProjections', (original, receiver, args) => isLocal(args[0]) ? Promise.resolve() : original.apply(receiver, args))
    wrap(manager, 'handleConnected', (original, receiver, args) => {
      const result = original.apply(receiver, args)
      if (active) for (const [id, item] of drafts) receiver.projectionStore(id).seed({ asOfSeq: 0, values: item.values })
      receiver.notifier.markDirty()
      return result
    })
    wrap(manager, 'createSession', (original, receiver, args) => {
      const session = original.apply(receiver, args)
      const releases: (() => void)[] = []
      const wrapSession = (key: string, replacement: Parameters<typeof wrapRuntimeMethod>[2]) => releases.push(wrap(session, key, replacement))
      if (isDraft(args[0])) {
        wrapSession('doOpen', () => {
          if (!active) throw new Error('Local draft adapter disposed')
          session.openState = 'open'
          session.notifier.markDirty()
          return Promise.resolve()
        })
      }
      // Associate admission and its durable retirement with this operation only.
      wrapSession('beginSubmission', (begin, owner, values) => {
        const operation = submissions.get(owner.sessionId)
        if (!operation) return begin.apply(owner, values)
        const request = values[0]
        const submission = begin.call(owner, { ...request, onRetire: (settlement: any) => {
          if (settlement.reason === 'observed') operation.observed = true
          request.onRetire?.(settlement)
        } })
        operation.requestId = submission.requestId
        return submission
      })
      wrapSession('prompt', async (prompt, owner, values) => {
        const operation = submissions.get(owner.sessionId)
        const result = await prompt.apply(owner, values)
        if (operation && operation.requestId === values[3] && result.ok) operation.accepted = true
        if (operation && operation.requestId === values[3] && !result.ok) operation.errorCode = result.error.code
        return result
      })
      const observeMessages = (owner: any, messages: any[]) => {
        const operation = submissions.get(owner.sessionId)
        if (operation && messages.some(message => matchesNativeSubmission(operation.requestId, message))) operation.observed = true
      }
      wrapSession('observeSubmissionEvent', (observe, owner, values) => {
        const event = values[0]
        if (event.type === 'user/message') observeMessages(owner, [event.data])
        if (event.type === 'agent/inbox/spliced') observeMessages(owner, event.data.inserted)
        return observe.apply(owner, values)
      })
      wrapSession('observeSubmissionInsertions', (observe, owner, values) => {
        observeMessages(owner, values[1])
        return observe.apply(owner, values)
      })
      wrapSession('dispose', async (originalDispose, owner, values) => {
        try { return await originalDispose.apply(owner, values) }
        finally { for (const release of releases.reverse()) release() }
      })
      return session
    })
    const methods: Record<string, (...args: any[]) => any> = {
      createProjectlessDraft(values) {
        requireActive()
        const sessionId = 'projectless-draft-' + crypto.randomUUID()
        const summary = { sessionId, updatedAt: Date.now(), running: false, blank: true, agentAvailable: true }
        drafts.set(sessionId, { summary, values })
        manager.recordMutation({ kind: 'placeholder', summary })
        manager.projectionStore(sessionId).seed({ asOfSeq: 0, values })
        sessions.projectList()
        return sessionId
      },
      isProjectlessDraft: isDraft,
      updateProjectlessDraft(id, key, value) {
        requireActive()
        const draft = drafts.get(id)
        if (!draft) throw new Error('Not a live projectless draft')
        draft.values[key] = value
        const store = manager.projectionStore(id)
        store.apply(key, value, (store.seqOf(key) ?? 0) + 1)
      },
      discardProjectlessDraft(id) {
        if (!drafts.delete(id)) return
        retiredIds.add(id)
        manager.handleSessionRemoved(id)
      },
    }
    for (const [key, method] of Object.entries(methods)) {
      if (key in sessions) throw new Error('Draft method already installed: ' + key)
      sessions[key] = method
      disposers.push(() => { if (sessions[key] === method) delete sessions[key] })
    }
    wrap(gateway, 'invoke', async (original, receiver, args) => {
      if (!args[2].active) return original.apply(receiver, args)
      const prepared = receiver.prepareInvocation(...args)
      if (!localIdentity(prepared.args)) return original.apply(receiver, args)
      if (!active || !business || status.state !== 'ready') return deny()
      prepared.signal.throwIfAborted()
      if (!args[2].active) return deny()
      const id = Object.values(prepared.args).find(isLocal) ?? Object.values(prepared.args).map((value: any) => value?.sessionId).find(isLocal)
      const positional = args[1]?.parameterIndex === 0 && id ? [id, ...args[4]] : args[4]
      const result = (await ctx.bail('projectless/draft-rpc', prepared.endpoint, positional, prepared.signal) ?? deny()) as any
      prepared.signal.throwIfAborted()
      if (!active || !args[2].active) return deny()
      if (!result.ok) return result
      const descriptor = args[0]
      return { ok: true, value: descriptor.result.mode === 'strict' && descriptor.result.decode ? descriptor.result.decode(result.value) : result.value }
    })
    wrap(gateway, 'invokeStream', (original, receiver, args) => {
      const prepared = receiver.prepareInvocation(...args)
      if (localIdentity(prepared.args)) throw new Error('本地草稿不支持会话流式端点')
      return original.apply(receiver, args)
    })
    wrap(conversation.input, 'sink', (original, receiver, args) => {
      if (!isLocal(args[0].sessionId)) return original.apply(receiver, args)
      if (args[1] === '' && args[2].length === 0) return Promise.resolve({ kind: 'success' })
      requireActive()
      return ctx.bail('projectless/first-send', ...args as [any, string, any, any, AbortSignal]) ?? Promise.resolve({ kind: 'error', text: '首次发送服务尚未就绪' })
    })
    wrap(conversation, 'beginFileUpload', (original, receiver, args) => {
      if (!isLocal(args[0])) return original.apply(receiver, args)
      requireActive()
      const attachment = args[1]
      receiver.fileUploadOperations.get(attachment.id)?.controller.abort()
      localFiles.set(attachment.id, args[0])
      receiver.fileUploads.update((state: any) => { state[attachment.id] = { status: 'projectless-pending' } })
    })
    wrap(conversation, 'releaseDraftAttachment', (original, receiver, args) => {
      localFiles.delete(args[0])
      return original.apply(receiver, args)
    })
    wrap(conversation, 'sendSession', async (original, receiver, args) => {
      const [session, , attachmentIds, , signal] = args
      if (isLocal(session.sessionId)) throw new Error('Local draft cannot be sent directly')
      const pending = []
      for (const id of attachmentIds) if (localFiles.has(id)) {
        const attachment = receiver.draftAttachments.get(id)
        if (attachment?.kind === 'file') {
          requireActive()
          signal?.throwIfAborted()
          receiver.beginFileUpload(session.sessionId, attachment)
          const operation = receiver.fileUploadOperations.get(id)
          const abort = () => operation.controller.abort()
          signal?.addEventListener('abort', abort, { once: true })
          pending.push(operation.done.finally(() => signal?.removeEventListener('abort', abort)))
        }
      }
      await Promise.all(pending)
      if (pending.length) requireActive()
      signal?.throwIfAborted()
      return original.apply(receiver, args)
    })
    const inputDefinition = core.entries('conversation.composer.bar')[0]
    if (!inputDefinition) throw new Error('Native input factory missing')
    if (core.entries('conversation.composer.bar').length !== 1) throw new Error('输入插槽存在其他接管，本组合尚未验证')
    const OriginalInput = inputDefinition.component
    function AdaptedInput(props: any) {
      const useFileUploads = (selector: any) => {
        const source = props.useFileUploads((value: any) => value)
        const display = useMemo(() => Object.fromEntries(Object.entries(source).map(([id, value]: any) => [id,
          isDraft(props.sessionId) && localFiles.get(id) === props.sessionId && value.status === 'projectless-pending'
            ? { status: 'ready' } : value])), [source, props.sessionId])
        return selector(display)
      }
      return createElement(OriginalInput, { ...props, useFileUploads })
    }
    Object.defineProperty(AdaptedInput, RUNTIME_WRAPPER, { value: { target: inputDefinition, original: OriginalInput, installed: AdaptedInput, generation } })
    disposers.push(() => {
      if (inputDefinition.component !== AdaptedInput) return
      inputDefinition.component = OriginalInput
      core.markDirty('conversation.composer.bar', core.record('conversation.composer.bar'))
    })
    inputDefinition.component = AdaptedInput
    core.markDirty('conversation.composer.bar', core.record('conversation.composer.bar'))
    const sidebar = core.entries('sidebar.workspaces')[0]
    if (!sidebar || core.entries('sidebar.workspaces').length !== 1) throw new Error('原生侧栏组件边界不匹配')
    const OriginalSidebar = sidebar.component
    function AdaptedSidebar(props: any) {
      return createElement('div', { style: { display: 'contents' }, onClickCapture: (event: any) => {
        if (!active || !business) return
        const button = event.target.closest?.('button[type="button"]')
        const row = button?.closest('[data-row-key="workspace:"]')
        if (!row || !event.currentTarget.contains(row) || button.getAttribute('aria-label') !== props.t('actions.newSession.aria', { name: props.t('group.ungrouped') })) return
        requireActive()
        event.preventDefault()
        event.stopPropagation()
        void ctx.bail('projectless/restore-draft')
      } }, createElement(OriginalSidebar, props))
    }
    sidebar.component = AdaptedSidebar
    core.markDirty('sidebar.workspaces', core.record('sidebar.workspaces'))
    disposers.push(() => {
      if (sidebar.component !== AdaptedSidebar) return
      sidebar.component = OriginalSidebar
      core.markDirty('sidebar.workspaces', core.record('sidebar.workspaces'))
    })
    const installFactory = () => {
      const definition = core.factory('conversation.content')
      if (!definition) return
      const Original = definition.component
      function AdaptedContent(props: any) {
        const renderSlot = (name: string, owner: any, ...rest: any[]) => {
          if (!active || !business) return props.renderSlot(name, owner, ...rest)
          if (name === 'conversation.hero.workspace') return createElement(Fragment, null,
            props.renderSlot(name, owner, ...rest),
            createElement(NativeProjectExtras, { owner, ctx, requireActive }))
          if (name !== 'conversation.composer.bar') return props.renderSlot(name, owner, ...rest)
          let input = owner
          if (isDraft(props.sessionId)) {
            const block = conversation.blocks.storeFor(props.sessionId).getSnapshot()
            input = { ...owner, disabled: false, placeholder: block?.reason ?? props.t('placeholder.hero'), ...block ? { blocked: block } : {} }
          }
          return createElement(Fragment, null,
            props.renderSlot(name, input, ...rest),
            createElement(DetachRetry, { sessionId: props.sessionId, ctx, requireActive }))
        }
        const workspaces = props.useWorkspaces((state: any) => state)
        const project = workspaces.items.find((item: any) => item.sessionIds.includes(props.sessionId))
        const t = (key: string, ...args: any[]) => key === 'hero.chooseWorkspace' && !project && active && business
          ? ctx.bail('projectless/label') ?? '无项目' : props.t(key, ...args)
        return createElement(Original, { ...props, renderSlot, t })
      }
      Object.defineProperty(AdaptedContent, RUNTIME_WRAPPER, { value: { target: definition, original: Original, installed: AdaptedContent, generation } })
      disposers.push(() => {
        if (definition.component !== AdaptedContent) return
        definition.component = Original
        core.markFactoryDirty(core.factoryRecord('conversation.content'))
      })
      definition.component = AdaptedContent
      core.markFactoryDirty(core.factoryRecord('conversation.content'))
    }
    installFactory()
    // A recreated native factory gets a new definition and therefore its own wrapper.
    let known = core.factory('conversation.content')
    disposers.push(core.subscribeFactory('conversation.content', () => {
      const next = core.factory('conversation.content')
      if (next === known || !active) return
      known = next
      installFactory()
    }))
    if (sessions.list.getSnapshot().phase === 'ready' && !restored) updateStatus('restart-required', '适配加载晚于原生启动恢复，请正常重启应用')
  } catch (error) {
    active = false
    for (const dispose of disposers.splice(0).reverse()) dispose()
    if (status.state !== 'conflict') updateStatus('failed', String(error))
  }
  const dispose = () => {
    if (!active && installations.get(key) !== runtime) return
    active = false
    business = false
    if (isDraft(navigation.mainReference?.sessionId)) navigation.clearMain()
    for (const id of drafts.keys()) { retiredIds.add(id); manager.handleSessionRemoved(id) }
    drafts.clear()
    for (const release of disposers.splice(0).reverse()) release()
    localFiles.clear()
    if (installations.get(key) === runtime) installations.delete(key)
    listeners.clear()
  }
  ctx.effect(() => dispose)
  const runtime: ClientRuntime = {
    getStatus: () => ({ ...status, missingCapabilities: [...status.missingCapabilities] }),
    subscribeStatus(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    confirm(host: RuntimeStatus) {
      if (!active || status.state === 'restart-required') return false
      if (host.state !== 'ready' || host.adapter !== ADAPTER_ID || host.version !== RUNTIME_PACKAGE_VERSION || host.build !== TARGET_BUILD || host.missingCapabilities.length > 0) {
        updateStatus('unsupported', host.reason || 'Host 与客户端适配版本不匹配')
        return false
      }
      business = true
      updateStatus('ready', '无项目运行时适配已就绪')
      return true
    },
    admission(sessionId: string) { return submissions.get(sessionId) },
    beginFirstSend(sessionId: string) { submissions.set(sessionId, { accepted: false, observed: false }) },
    fail(reason: string) { business = false; updateStatus('failed', reason) },
    dispose,
  }
  installations.set(key, runtime)
  return runtime
}

/** Supplement the native chip in place, without moving its DOM or layout seat. */
function NativeProjectExtras({ owner, ctx, requireActive }: any) {
  const [seat, setSeat] = useState<HTMLElement | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const anchor = owner.anchorRef?.current as HTMLButtonElement | undefined
    if (!anchor || owner.selectedId === undefined) { setSeat(null); return }
    const row = anchor.parentElement!
    const position = row.style.position
    row.style.position = 'relative'
    anchor.dataset.projectlessChip = ''
    setSeat(row)
    const place = () => {
      const icon = (anchor.querySelector('svg') ?? anchor).getBoundingClientRect()
      const bounds = row.getBoundingClientRect()
      if (!button.current) return
      button.current.style.left = (icon.left - bounds.left) + 'px'
      button.current.style.top = (icon.top - bounds.top) + 'px'
    }
    const observer = new ResizeObserver(place)
    observer.observe(row)
    return () => { observer.disconnect(); delete anchor.dataset.projectlessChip; row.style.position = position }
  }, [owner.anchorRef, owner.selectedId])
  return seat && owner.selectedId !== undefined ? createPortal(
    <button type="button" ref={button} className="dsh-projectless-entry" aria-label="切换到无项目" title="切换到无项目"
      onClick={event => { event.stopPropagation(); requireActive(); void ctx.bail('projectless/open-draft') }}>
      <IconCloseOutlineRegular size={16} />
    </button>, seat) : null
}

function DetachRetry({ sessionId, ctx, requireActive }: any) {
  const [detached, setDetached] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState('')
  useLayoutEffect(() => { setDetached(false); setError('') }, [sessionId])
  if (detached || !ctx.bail('projectless/detach-pending', sessionId)) return null
  return <div className="dsh-projectless-detach-retry">
    <button type="button" disabled={retrying} onClick={() => {
      requireActive()
      setRetrying(true)
      Promise.resolve(ctx.bail('projectless/retry-detach', sessionId)).then(() => setDetached(true), error => setError(String(error))).finally(() => setRetrying(false))
    }}>重试注销临时工作区</button>
    {error && <span role="status">{error}</span>}
  </div>
}
