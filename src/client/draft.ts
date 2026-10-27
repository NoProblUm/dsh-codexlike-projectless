import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { StartSessionOptions } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { DraftAttachmentId, SubmitOutcome } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { createAndSendProjectlessSession, RollbackIncompleteError } from './first-prompt.ts'
import { createProjectlessRegistry, isCurrentSession, requestProjectlessDirectory, requestProjectlessRoot, requestRemoveProjectlessDirectory, type ProjectlessSessionHost, type ProjectlessSessionReceipt } from './session.ts'
import { PROJECTLESS_RPC_CHANNEL, projectlessEndpoint } from '../shared/rpc.ts'
import type { DiagnosticSink } from '../shared/diagnostics.ts'
import type { DraftSessions, NativeConversation, PreparedTitle } from '../shared/native.ts'

import { createDraftCache, decodeSelection, SELECTION_KEY, type Selection } from './selection.ts'
import type { activateClientRuntime } from './runtime.tsx'
import { classifyNativeAdmission } from './admission.ts'
import { requireCatalogSelection } from './model.ts'
import type { ModelCatalog } from '@deepseek-ai/dsh-api-session-controller'
interface Draft {
  model: { provider: string, model: string, reasoningEffort?: string }
  permission: string
  preset?: string
  plan: boolean
  busy: boolean
  uncertain: boolean
  cleanupBlocked?: boolean
  lastUsed: number
  receipt?: ProjectlessSessionReceipt
  admissionReference?: ReturnType<DraftSessions['retain']>
}

/** Uses the native browser draft, title provider, controls and submission sink. */
export function installProjectlessDrafts(ctx: Context, host: ProjectlessSessionHost,
  pending: Set<WorkspaceId>, diagnostics: DiagnosticSink, onError: (error: unknown) => void,
  adapter: Pick<ReturnType<typeof activateClientRuntime>, 'admission' | 'beginFirstSend'>) {
  const sessions = ctx.sessions as DraftSessions
  if (typeof sessions.createProjectlessDraft !== 'function') {
    throw new Error('无项目运行时适配尚未就绪')
  }
  const conversation = ctx.conversation as NativeConversation
  const rpc = ctx.connection.rpc as unknown as ClientConnectionRpc
  const drafts = new Map<SessionId, Draft>()
  const registry = createProjectlessRegistry()
  const cache = createDraftCache<SessionId>()
  const held = new Map<SessionId, ReturnType<DraftSessions['retain']>>()
  const projectlessSessions = new Set<SessionId>()
  const detachments = new Map<SessionId, ProjectlessSessionReceipt>()
  let disposed = false
  const lifetime = new AbortController()
  let initialized = false
  let navigationQueue: Promise<void> = Promise.resolve()
  const schedule = <T>(action: () => Promise<T>): Promise<T> => {
    const result = navigationQueue.then(action)
    navigationQueue = result.then(() => {}, () => {})
    return result
  }
  let editorUse = 0
  let selection: Selection
  try { selection = decodeSelection(localStorage.getItem(SELECTION_KEY)) } catch { selection = { kind: 'unset' } }
  const readSelection = (): WorkspaceId | undefined => {
    return selection.kind === 'project' ? selection.workspaceId as WorkspaceId : undefined
  }
  const select = (workspaceId?: WorkspaceId): void => {
    selection = workspaceId === undefined ? { kind: 'projectless' } : { kind: 'project', workspaceId }
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify(selection)) } catch { /* Navigation still works with storage disabled. */ }
  }
  const keyOf = (workspaceId?: WorkspaceId) => workspaceId ?? '::dsh-codexlike-projectless'
  const currentId = () => {
    const snapshot = sessions.list.getSnapshot()
    return (snapshot.ids as SessionId[]).find(id => isCurrentSession(snapshot, id))
  }
  const workspaceOf = (id: SessionId) => ctx.workspaces.list.getSnapshot().items.find(item => item.sessionIds.includes(id))?.workspaceId
  const isProjectlessSession = (id: SessionId) => drafts.has(id) || projectlessSessions.has(id)
    || (sessions.list.getSnapshot().byId[id] !== undefined && ctx.workspaces.list.getSnapshot().phase === 'ready' && workspaceOf(id) === undefined)
  const rememberBlank = (id: SessionId, workspaceId?: WorkspaceId) => {
    cache.remember(keyOf(workspaceId), id)
    const draft = drafts.get(id)
    if (draft) draft.lastUsed = ++editorUse
    if (!held.has(id)) held.set(id, sessions.retain(id, { source: 'controllerOperation' }))
  }
  type Result<T> = { ok: true, value: T } | { ok: false, error: { code: string, message: string } }
  const nativeCall = async <T>(namespace: string, method: string, ...args: unknown[]): Promise<T> => {
    const remote = (ctx as unknown as { remote: Record<string, Record<string, (...args: unknown[]) => Promise<Result<T>>>> }).remote
    const action = remote[namespace]?.[method]
    if (action === undefined) throw new Error(`Native ${namespace}/${method} is unavailable`)
    const result = await action(...args)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const pluginCall = async <T>(endpoint: 'prepare-title' | 'bind-title', payload: unknown, signal?: AbortSignal): Promise<T> => {
    const result = await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint(endpoint), payload, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value as T
  }
  const createDraft = async (requestedPreset?: string): Promise<SessionId> => {
    const catalog = await nativeCall<ModelCatalog>('session', 'modelCatalog')
    requireCatalogSelection(catalog, catalog.default)
    const presets = await nativeCall<{ presets: { id: string, isDefault?: boolean }[] }>('agentPresets', 'list')
    const permissions = await nativeCall<{ defaultPreset: string }>('permissionPresets', 'catalog')
    if (disposed) throw new Error('Projectless plugin unloaded')
    const preset = requestedPreset ?? presets.presets.find(item => item.isDefault)?.id
    const draft: Draft = { model: catalog.default, permission: permissions.defaultPreset,
      ...preset === undefined ? {} : { preset }, plan: false, busy: false, uncertain: false, lastUsed: 0 }
    const id = sessions.createProjectlessDraft({ modelSelection: { next: draft.model }, permissions: { currentValue: draft.permission },
      agentPreset: preset, plan: { active: false }, inbox: { 'next-turn': [] } })
    drafts.set(id, draft)
    projectlessSessions.add(id)
    rememberBlank(id)
    return id
  }

  const openEditor = async (workspaceId?: WorkspaceId, options?: StartSessionOptions): Promise<SessionId | undefined> => {
    const previous = currentId()
    if (previous !== undefined && sessions.list.getSnapshot().byId[previous]?.blank) {
      rememberBlank(previous, isProjectlessSession(previous) ? undefined : workspaceOf(previous))
    }
    if (workspaceId === undefined) {
      const snapshot = sessions.list.getSnapshot()
      const target = [...drafts].filter(([id, draft]) => {
        const summary = snapshot.byId[id]
        const preset = summary?.projectionValues?.agentPreset
        return summary?.blank && !draft.busy && !draft.uncertain && !draft.cleanupBlocked
          && (options?.agentPreset === undefined || typeof preset !== 'string' || preset === options.agentPreset)
      }).sort((a, b) => b[1].lastUsed - a[1].lastUsed)[0]?.[0] ?? await createDraft(options?.agentPreset)
      if (disposed) throw new Error('Projectless plugin unloaded')
      select()
      rememberBlank(target)
      if (previous !== target) ctx.uiWorkspace.openSession(target)
      const initialize = options !== undefined && (options.prompt !== undefined
        || (options.whenDraftExists ?? (options.clearPreviousDraft === true ? 'replace' : 'keep')) === 'replace')
      if (initialize) {
        const reference = held.get(target)
        if (reference === undefined) throw new Error('草稿输入作用域不可用')
        const binding = await reference.ready
        if (disposed) throw new Error('Projectless plugin unloaded')
        if (conversation.input.requestDraftInitialization(binding, options) === 'blocked') throw new Error('输入已锁定，无法初始化新草稿')
      }
      return target
    }
    const target = cache.find(keyOf(workspaceId))
    const workspace = ctx.workspaces.list.getSnapshot()
    if (target !== undefined && sessions.list.getSnapshot().byId[target]?.blank
      && !workspace.archivedSessionIds?.includes(target)
      && workspace.items.some(item => item.workspaceId === workspaceId && item.sessionIds.includes(target))) {
      select(workspaceId)
      if (previous !== target) ctx.uiWorkspace.openSession(target)
      return target
    }
    select(workspaceId)
    await ctx.uiWorkspace.openWorkspace(workspaceId)
    return currentId()
  }
  const switchProjectless = () => schedule(async () => {
    const id = await openEditor()
    if (id === undefined) throw new Error('无项目草稿不可用')
    return id
  })
  const restore = switchProjectless
  ctx.on('projectless/select-workspace', workspaceId => schedule(() => openEditor(workspaceId)).then(() => {}))
  ctx.on('projectless/detach-pending', id => detachments.has(id))
  ctx.on('projectless/retry-detach', async id => {
    const receipt = detachments.get(id)
    if (disposed || receipt === undefined) throw new Error('没有可重试的已接收会话注销操作')
    await host.delete(receipt.workspaceId)
    detachments.delete(id)
    pending.delete(receipt.workspaceId)
  })
  ctx.on('projectless/new-session', (workspaceId, currentSessionId, options) => {
    const current = currentSessionId ?? currentId()
    if (workspaceId !== undefined || current !== undefined && workspaceOf(current) !== undefined) return undefined
    void schedule(() => openEditor(undefined, options)).catch(onError)
    return true
  })

  // Native Gateway supplies validated positional args. Draft identities never reach Host execution.
  ctx.on('projectless/draft-rpc', async (endpoint, args, signal) => {
    const input = args[0]
    const id = (typeof input === 'string' ? input : typeof input === 'object' && input !== null
      ? (input as { sessionId?: string }).sessionId : undefined) as SessionId | undefined
    const draft = id === undefined ? undefined : drafts.get(id)
    if (draft === undefined || id === undefined) return undefined
    const success = (value: unknown) => Promise.resolve({ ok: true, value })
    if (endpoint === 'commands/list') return success([
      { name: 'permission', description: '选择权限模式', input: { hint: '权限模式' } },
      { name: 'plan', description: '切换规划模式' },
    ])
    if (endpoint === 'session/selectModel') {
      const model = input as Draft['model']
      const catalog = await nativeCall<ModelCatalog>('session', 'modelCatalog')
      signal.throwIfAborted()
      if (disposed) throw new Error('Projectless plugin unloaded')
      requireCatalogSelection(catalog, model)
      draft.model = { provider: model.provider, model: model.model,
        ...model.reasoningEffort === undefined ? {} : { reasoningEffort: model.reasoningEffort } }
      sessions.updateProjectlessDraft(id, 'modelSelection', { next: draft.model })
      return success({})
    }
    if (endpoint === 'agentPresets/select') {
      draft.preset = String(args[1])
      sessions.updateProjectlessDraft(id, 'agentPreset', draft.preset)
      return success(draft.preset)
    }
    if (endpoint === 'commands/execute') {
      const line = String(args[1])
      const permission = /^\/permission\s+(\S+)\s*$/.exec(line)?.[1]
      if (permission !== undefined) {
        draft.permission = permission
        sessions.updateProjectlessDraft(id, 'permissions', { currentValue: permission })
        return success({ commandId: `draft-${crypto.randomUUID()}`, result: { kind: 'success' } })
      }
      if (/^\/plan(?:\s+(?:on|off))?\s*$/.test(line)) {
        draft.plan = line.endsWith(' off') ? false : line.endsWith(' on') ? true : !draft.plan
        sessions.updateProjectlessDraft(id, 'plan', { active: draft.plan })
        return success({ commandId: `draft-${crypto.randomUUID()}`, result: { kind: 'success' } })
      }
    }
    return Promise.resolve({ ok: false, error: { code: 'projectless/draft-only',
      message: '此操作需要已创建的会话。先发送首条消息，再使用该命令。', details: {} } })
  })

  ctx.on('projectless/first-send', (session, text, attachments, mode, signal) => {
    signal = AbortSignal.any([signal, lifetime.signal])
    const draft = drafts.get(session.sessionId)
    if (draft === undefined) return undefined
    if (draft.busy || draft.uncertain || draft.cleanupBlocked) return Promise.resolve({ kind: 'error', text: '首次发送仍在处理或结果尚未确认，请勿重复发送。' })
    const choice = { ...draft, model: { ...draft.model } }
    draft.busy = true
    conversation.blocks.set(session.sessionId, { reason: '正在生成主题并创建会话…' })
    const reference = sessions.retain(session.sessionId, { source: 'controllerOperation' })
    return (async (): Promise<SubmitOutcome> => {
      try {
        const root = await requestProjectlessRoot(rpc)
        const result = await createAndSendProjectlessSession(host, {
          list: sessions.list, open: id => ctx.uiWorkspace.openSession(id),
        }, { text, attachments, mode, signal }, {
          prepareTitle: async input => {
            signal.throwIfAborted()
            const catalog = await nativeCall<ModelCatalog>('session', 'modelCatalog')
            signal.throwIfAborted()
            requireCatalogSelection(catalog, choice.model)
            return pluginCall<PreparedTitle>('prepare-title', {
              text: input.text || '附件分析', route: choice.model, sessionId: crypto.randomUUID(),
            }, signal)
          },
          provisionDirectory: title => requestProjectlessDirectory(rpc, title, undefined, root),
          createSession: async (workspaceId, title) => {
            projectlessSessions.add(title.sessionId)
            return sessions.create({ workspaceId, sessionId: title.sessionId })
          },
          bindPreparedTitle: async (id, title) => {
            signal.throwIfAborted()
            await pluginCall('bind-title', { sessionId: id, token: title.token }, signal)
            if (choice.preset !== undefined) await nativeCall('agentPresets', 'select', id, choice.preset)
            await nativeCall('session', 'selectModel', { sessionId: id, ...choice.model })
            const applyCommand = async (line: string) => {
              const result = await nativeCall<{ result: { kind: string, text?: string } } | undefined>('commands', 'execute', id, line, [])
              if (result === undefined) throw new Error(`当前 Agent 预设不支持设置：${line}`)
              if (result.result.kind !== 'success') throw new Error(result.result.text ?? `设置失败：${line}`)
            }
            await applyCommand(`/permission ${choice.permission}`)
            // Native /plan accepts an optional MESSAGE; "on" is not a flag.
            if (choice.plan) await applyCommand('/plan')
          },
          send: async (id, input) => sessions.using(id, { source: 'controllerOperation' }, async reference => {
            const binding = await reference.ready
            adapter.beginFirstSend(id)
            let outcome
            try { outcome = await conversation.sendSession(binding.session, input.text, input.attachments, input.mode, input.signal) }
            catch (error) {
              if (!adapter.admission(id)?.requestId) { onError(error); return 'rejected' }
              throw error
            }
            const admission = adapter.admission(id)
            return classifyNativeAdmission(admission, outcome)
          }),
          removeDirectory: path => requestRemoveProjectlessDirectory(rpc, path).then(() => {}),
          isCurrentTarget: () => isCurrentSession(sessions.list.getSnapshot(), session.sessionId),
          signal,
          onError,
        }, registry, pending, diagnostics)
        if (result.acceptance === 'unknown') {
          draft.uncertain = true
          draft.receipt = result.receipt
          draft.admissionReference = sessions.retain(result.receipt.sessionId, { source: 'controllerOperation' })
          void draft.admissionReference.ready.then(reconcile).catch(onError)
          reconcile()
          return { kind: 'error', text: `发送结果尚未确认。请查看会话 ${result.receipt.sessionId}，不要重复发送。` }
        }
        if (result.acceptance === 'accepted') {
          if (result.detachmentPending) detachments.set(result.receipt.sessionId, result.receipt)
          releaseDraft(session.sessionId)
        }
        return result.acceptance === 'accepted' ? { kind: 'success' } : { kind: 'error' }
      } catch (error) {
        if (error instanceof RollbackIncompleteError) draft.cleanupBlocked = true
        onError(error)
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      } finally {
        draft.busy = false
        if (!disposed && !draft.uncertain && !draft.cleanupBlocked) conversation.blocks.set(session.sessionId, undefined)
        reference.release()
      }
    })()
  })

  const releaseDraft = (id: SessionId): void => {
    const draft = drafts.get(id)
    drafts.delete(id)
    cache.remove(id)
    const reference = held.get(id)
    held.delete(id)
    reference?.release()
    draft?.admissionReference?.release()
    if (draft) sessions.discardProjectlessDraft(id)
  }
  const reconcile = (): void => {
    for (const [id, draft] of drafts) {
      const receipt = draft.receipt
      if (!draft.uncertain || receipt === undefined || !adapter.admission(receipt.sessionId)?.observed) continue
      // Match the native request identity, never another message's nonblank summary.
      delete draft.receipt
      void host.delete(receipt.workspaceId).then(() => pending.delete(receipt.workspaceId)).catch(error => {
        detachments.set(receipt.sessionId, receipt)
        onError(error)
      }).finally(() => {
        if (disposed) return
        draft.uncertain = false
        conversation.blocks.set(id, undefined)
        if (isCurrentSession(sessions.list.getSnapshot(), id)) ctx.uiWorkspace.openSession(receipt.sessionId)
        releaseDraft(id)
      })
    }
  }
  let observing = false
  const observe = (): void => {
    if (observing || disposed || !initialized || sessions.list.getSnapshot().phase !== 'ready' || ctx.workspaces.list.getSnapshot().phase !== 'ready') return
    observing = true
    try {
      reconcile()
      for (const id of held.keys()) {
        if (!drafts.has(id) && sessions.list.getSnapshot().byId[id]?.blank === false) releaseDraft(id)
      }
      const id = currentId()
      if (id !== undefined) {
        const workspaceId = isProjectlessSession(id) ? undefined : workspaceOf(id)
        if (workspaceId === undefined || !pending.has(workspaceId)) select(workspaceId)
        if (sessions.list.getSnapshot().byId[id]?.blank) rememberBlank(id, workspaceId)
      } else if (readSelection() !== undefined && !ctx.workspaces.list.getSnapshot().items.some(item => item.workspaceId === readSelection())) select()
    } finally { observing = false }
  }
  ctx.effect(() => {
    const offSessions = sessions.list.subscribe(observe)
    const offWorkspaces = ctx.workspaces.list.subscribe(observe)
    return () => { offSessions(); offWorkspaces() }
  }, 'projectless: follow selection and retain browser drafts')
  ctx.effect(() => {
    const initialize = (): void => {
      if (initialized || sessions.list.getSnapshot().phase !== 'ready' || ctx.workspaces.list.getSnapshot().phase !== 'ready') return
      initialized = true
      const current = currentId()
      if (selection.kind === 'projectless' && (current === undefined || sessions.list.getSnapshot().byId[current]?.blank)) {
        const selected = readSelection()
        const target = selected !== undefined && ctx.workspaces.list.getSnapshot().items.some(item => item.workspaceId === selected) ? selected : undefined
        void schedule(() => openEditor(target)).catch(onError)
      } else observe()
    }
    const offSessions = sessions.list.subscribe(initialize)
    const offWorkspaces = ctx.workspaces.list.subscribe(initialize)
    initialize()
    return () => { offSessions(); offWorkspaces() }
  }, 'projectless: restore the empty project choice')
  ctx.effect(() => () => {
    disposed = true
    lifetime.abort(new Error('Projectless plugin unloaded'))
    for (const reference of held.values()) reference.release()
    held.clear()
    for (const [id, draft] of drafts) { draft.admissionReference?.release(); sessions.discardProjectlessDraft(id) }
  }, 'projectless: draft lifetime')
  return { start: switchProjectless, restore, select, switchWorkspace: (id: WorkspaceId) => schedule(() => openEditor(id)).then(() => {}), isProjectlessSession }
}
