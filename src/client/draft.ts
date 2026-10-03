import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { DraftAttachmentId, SubmitOutcome } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { createAndSendProjectlessSession } from './first-prompt.ts'
import { createProjectlessRegistry, isCurrentSession, requestProjectlessDirectory, requestProjectlessRoot, requestRemoveProjectlessDirectory, type ProjectlessSessionHost, type ProjectlessSessionReceipt } from './session.ts'
import { PROJECTLESS_RPC_CHANNEL, projectlessEndpoint } from '../shared/rpc.ts'
import type { DiagnosticSink } from '../shared/diagnostics.ts'
import type { DraftSessions, NativeConversation, PreparedTitle } from '../shared/native.ts'

import { createDraftCache, decodeSelection, SELECTION_KEY, type Selection } from './selection.ts'
interface Draft {
  model: { provider: string, model: string, reasoningEffort?: string }
  permission: string
  preset?: string
  plan: boolean
  busy: boolean
  uncertain: boolean
  receipt?: ProjectlessSessionReceipt
}

/** Uses the native browser draft, title provider, controls and submission sink. */
export function installProjectlessDrafts(ctx: Context, host: ProjectlessSessionHost,
  pending: Set<WorkspaceId>, diagnostics: DiagnosticSink, onError: (error: unknown) => void) {
  const sessions = ctx.sessions as DraftSessions
  if (typeof sessions.createProjectlessDraft !== 'function') {
    throw new Error('This local build requires the DSH 0.2.0-rc.2 native bridge. Run the supplied native installer first.')
  }
  const conversation = ctx.conversation as NativeConversation
  const rpc = ctx.connection.rpc as unknown as ClientConnectionRpc
  const drafts = new Map<SessionId, Draft>()
  const registry = createProjectlessRegistry()
  const cache = createDraftCache<SessionId>()
  const held = new Map<SessionId, ReturnType<DraftSessions['retain']>>()
  const projectlessSessions = new Set<SessionId>()
  let disposed = false
  let initialized = false
  let starting: Promise<SessionId> | undefined
  let selection: Selection
  try { selection = decodeSelection(localStorage.getItem(SELECTION_KEY)) } catch { selection = { kind: 'unset' } }
  const readSelection = (): WorkspaceId | undefined => {
    return selection.kind === 'project' ? selection.workspaceId as WorkspaceId : undefined
  }
  const select = (workspaceId?: WorkspaceId): void => {
    selection = workspaceId === undefined ? { kind: 'projectless' } : { kind: 'project', workspaceId }
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify(selection)) } catch { /* Navigation still works with storage disabled. */ }
  }
  const keyOf = (workspaceId?: WorkspaceId) => workspaceId ?? '::projectless-session'
  const currentId = () => {
    const snapshot = sessions.list.getSnapshot()
    return (snapshot.ids as SessionId[]).find(id => isCurrentSession(snapshot, id))
  }
  const workspaceOf = (id: SessionId) => ctx.workspaces.list.getSnapshot().items.find(item => item.sessionIds.includes(id))?.workspaceId
  const isProjectlessSession = (id: SessionId) => drafts.has(id) || projectlessSessions.has(id)
    || (sessions.list.getSnapshot().byId[id] !== undefined && ctx.workspaces.list.getSnapshot().phase === 'ready' && workspaceOf(id) === undefined)
  const rememberBlank = (id: SessionId, workspaceId?: WorkspaceId) => {
    cache.remember(keyOf(workspaceId), id)
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
  const pluginCall = async <T>(endpoint: 'prepare-title' | 'bind-title', payload: unknown): Promise<T> => {
    const result = await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint(endpoint), payload)
    if (!result.ok) throw new Error(result.error.message)
    return result.value as T
  }
  const start = (): Promise<SessionId> => {
    if (starting !== undefined) return starting
    starting = (async () => {
      const catalog = await nativeCall<{ default: Draft['model'] }>('session', 'modelCatalog')
      const presets = await nativeCall<{ presets: { id: string, isDefault?: boolean }[] }>('agentPresets', 'list')
      const permissions = await nativeCall<{ defaultPreset: string }>('permissionPresets', 'catalog')
      if (disposed) throw new Error('Projectless plugin unloaded')
      const preset = presets.presets.find(item => item.isDefault)?.id
      const draft: Draft = { model: catalog.default, permission: permissions.defaultPreset,
        ...preset === undefined ? {} : { preset }, plan: false, busy: false, uncertain: false }
      const id = sessions.createProjectlessDraft({ modelSelection: { next: draft.model }, permissions: { currentValue: draft.permission },
        agentPreset: preset, plan: { active: false }, inbox: { 'next-turn': [] } })
      drafts.set(id, draft)
      projectlessSessions.add(id)
      rememberBlank(id)
      select()
      ctx.uiWorkspace.openSession(id)
      return id
    })().finally(() => { starting = undefined })
    return starting
  }

  const openEditor = (workspaceId?: WorkspaceId, fresh = false): Promise<SessionId> => {
    const previous = currentId()
    if (previous !== undefined && sessions.list.getSnapshot().byId[previous]?.blank) {
      rememberBlank(previous, isProjectlessSession(previous) ? undefined : workspaceOf(previous))
    }
    const target = fresh ? undefined : cache.find(keyOf(workspaceId))
    if (target !== undefined && sessions.list.getSnapshot().byId[target]?.blank) {
      select(workspaceId)
      ctx.uiWorkspace.openSession(target)
      return Promise.resolve(target)
    }
    if (workspaceId === undefined) return start()
    return sessions.create({ workspaceId }).then(id => {
      if (disposed) throw new Error('Projectless plugin unloaded')
      rememberBlank(id, workspaceId)
      select(workspaceId)
      ctx.uiWorkspace.openSession(id)
      return id
    })
  }
  const switchProjectless = () => {
    const id = currentId()
    return openEditor(undefined, id !== undefined && sessions.list.getSnapshot().byId[id]?.blank === false)
  }
  ctx.on('projectless/select-workspace', workspaceId => openEditor(workspaceId).then(() => {}))
  ctx.on('projectless/new-session', (workspaceId, currentSessionId) => {
    const id = currentSessionId ?? currentId()
    const inherited = id === undefined ? readSelection() : isProjectlessSession(id) ? undefined : workspaceOf(id)
    const selected = workspaceId ?? inherited
    const target = selected !== undefined && ctx.workspaces.list.getSnapshot().items.some(item => item.workspaceId === selected) ? selected : undefined
    void openEditor(target, true).catch(onError)
    return true
  })

  // Native Gateway supplies validated positional args. Draft identities never reach Host execution.
  ctx.on('projectless/draft-rpc', (endpoint, args) => {
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
    const draft = drafts.get(session.sessionId)
    if (draft === undefined) return undefined
    if (draft.busy || draft.uncertain) return Promise.resolve({ kind: 'error', text: '首次发送仍在处理或结果尚未确认，请勿重复发送。' })
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
            return pluginCall<PreparedTitle>('prepare-title', {
              text: input.text || '附件分析', route: choice.model, sessionId: crypto.randomUUID(),
            })
          },
          provisionDirectory: title => requestProjectlessDirectory(rpc, title, undefined, root),
          createSession: async (workspaceId, title) => {
            projectlessSessions.add(title.sessionId)
            return sessions.create({ workspaceId, sessionId: title.sessionId })
          },
          bindPreparedTitle: async (id, title) => {
            signal.throwIfAborted()
            await pluginCall('bind-title', { sessionId: id, token: title.token })
            if (choice.preset !== undefined) await nativeCall('agentPresets', 'select', id, choice.preset)
            await nativeCall('session', 'selectModel', { sessionId: id, ...choice.model })
            await sessions.using(id, { source: 'controllerOperation' }, async reference => {
              const binding = await reference.ready
              const permission = await binding.session.command(`/permission ${choice.permission}`)
              if (!permission.ok) throw new Error(permission.error.message)
              if (choice.plan) {
                const plan = await binding.session.command('/plan on')
                if (!plan.ok) throw new Error(plan.error.message)
              }
            })
          },
          send: async (id, input) => sessions.using(id, { source: 'controllerOperation' }, async reference => {
            const binding = await reference.ready
            const outcome = await conversation.sendSession(binding.session, input.text, input.attachments, input.mode, input.signal)
            if (outcome.kind === 'success') return 'accepted'
            if (outcome.remoteError?.code.startsWith('carrier/') || outcome.remoteError?.code.includes('cancel')) return 'unknown'
            return 'rejected'
          }),
          removeDirectory: path => requestRemoveProjectlessDirectory(rpc, path).then(() => {}),
          isCurrentTarget: () => isCurrentSession(sessions.list.getSnapshot(), session.sessionId),
          onError,
        }, registry, pending, diagnostics)
        if (result.acceptance === 'unknown') {
          draft.uncertain = true
          draft.receipt = result.receipt
          conversation.input.for(reference.binding.ctx).notify('error', `发送结果尚未确认。请查看会话 ${result.receipt.sessionId}，不要重复发送。`)
          reconcile()
          return { kind: 'success' }
        }
        if (result.acceptance === 'accepted') releaseDraft(session.sessionId)
        return result.acceptance === 'accepted' ? { kind: 'success' } : { kind: 'error' }
      } catch (error) {
        onError(error)
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      } finally {
        draft.busy = false
        if (!draft.uncertain) conversation.blocks.set(session.sessionId, undefined)
        reference.release()
      }
    })()
  })

  const releaseDraft = (id: SessionId): void => {
    cache.remove(id)
    const reference = held.get(id)
    held.delete(id)
    reference?.release()
    if (drafts.delete(id)) sessions.discardProjectlessDraft(id)
  }
  const reconcile = (): void => {
    for (const [id, draft] of drafts) {
      const receipt = draft.receipt
      if (!draft.uncertain || receipt === undefined || sessions.list.getSnapshot().byId[receipt.sessionId]?.blank !== false) continue
      // The durable native summary proves admission; never resend an uncertain prompt.
      delete draft.receipt
      void host.delete(receipt.workspaceId).then(() => pending.delete(receipt.workspaceId)).catch(onError).finally(() => {
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
      if (current === undefined || sessions.list.getSnapshot().byId[current]?.blank) {
        const selected = readSelection()
        const target = selected !== undefined && ctx.workspaces.list.getSnapshot().items.some(item => item.workspaceId === selected) ? selected : undefined
        void openEditor(target, true).catch(onError)
      } else observe()
    }
    const offSessions = sessions.list.subscribe(initialize)
    const offWorkspaces = ctx.workspaces.list.subscribe(initialize)
    initialize()
    return () => { offSessions(); offWorkspaces() }
  }, 'projectless: restore the empty project choice')
  ctx.effect(() => () => {
    disposed = true
    for (const reference of held.values()) reference.release()
    held.clear()
    for (const id of drafts.keys()) sessions.discardProjectlessDraft(id)
  }, 'projectless: draft lifetime')
  return { start: switchProjectless, select, switchWorkspace: (id: WorkspaceId) => openEditor(id).then(() => {}), isProjectlessSession }
}
