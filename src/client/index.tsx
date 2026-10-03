import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {
  HostObservable,
  PropsHooks,
  PropsLocale,
  PropsRenderSlots,
  PropsRuntime,
  StoredEntry,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { DirectoryFlowOwnerProps, UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import {
  Button,
  IconFolderCloseRegular,
  IconNewChatOutlineRegular,
  IconPlusOutlineRegular,
  Menu,
  Modal,
  type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  PROJECTLESS_ENTRY_ID,
  createAbandonClaim,
  createProjectlessRegistry,
  isProjectlessPath,
  requestProjectlessSettings,
  requestRemoveProjectlessDirectory,
  resolvePickerSelection,
  sweepAbandonedProjectlessWorkspaces,
} from './session.ts'
import { PROJECTLESS_LOCALE_NS, projectlessLocales } from './locales.ts'
import { PROJECTLESS_RPC_CHANNEL, projectlessEndpoint } from '../shared/rpc.ts'
import { diagnosticErrorCode, type DiagnosticSink } from '../shared/diagnostics.ts'
import { installProjectlessDrafts } from './draft.ts'
import { ProjectlessSettings } from './settings.tsx'

const PACKAGE_ID = 'dsh-projectless-session'
export { createAndSendProjectlessSession } from './first-prompt.ts'
export type { FirstPromptServices, PromptAcceptance } from './first-prompt.ts'
const PROJECTLESS = PROJECTLESS_ENTRY_ID
const ADD_WORKSPACE = '::add-workspace'
const DSH_DIRECTORY_FLOW = 'conversation.hero.workspace.directoryFlow'
const DIRECTORY_FLOW = 'dsh-projectless-session.directoryFlow'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** This picker's own directory-flow hole, mirrored from DSH's hero hole. */
    'dsh-projectless-session.directoryFlow': {
      kind: 'single'
      scope: 'root'
      owner: DirectoryFlowOwnerProps
    }
    'projectless.entry': { kind: 'single', scope: 'root', owner: { children?: never } }
  }
}

interface PickerActions {
  createWorkspace(input: { path: string }): Promise<WorkspaceView>
  createProjectlessSession(): Promise<SessionId>
  selectWorkspace(workspaceId: WorkspaceId): Promise<void>
  isProjectlessWorkspace(workspace: WorkspaceView): boolean
  hooks: {
    directoryFlow: HostObservable<boolean>
  }
}

type PickerProps =
  PropsRuntime<'conversation.hero.workspace'>
  & PropsRenderSlots<typeof DIRECTORY_FLOW>
  & Omit<PickerActions, 'hooks'>
  & PropsHooks<PickerActions['hooks']>
  & PropsLocale<typeof PROJECTLESS_LOCALE_NS>

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/** Shadow-compatible replacement for the built-in WorkspacePicker. */
function ProjectlessWorkspacePicker({
  open,
  anchorRef,
  selectedId,
  onPick,
  onClose,
  useWorkspaces,
  createWorkspace,
  createProjectlessSession,
  selectWorkspace,
  isProjectlessWorkspace,
  useDirectoryFlow,
  renderSlot,
  t,
}: PickerProps) {
  const workspaceState = useWorkspaces((state: { items: readonly WorkspaceView[] }) => state)
  const [busy, setBusy] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const getAnchorRect = useCallback(
    () => (anchorRef as RefObject<HTMLElement | null> | undefined)?.current?.getBoundingClientRect() ?? null,
    [anchorRef],
  )

  const selection = resolvePickerSelection(
    workspaceState.items,
    selectedId,
    isProjectlessWorkspace,
  )
  const workspaceItems: MenuEntry[] = selection.projects.map(workspace => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: <IconFolderCloseRegular size={16} />,
    disabled: busy,
  }))
  const flowAvailable = useDirectoryFlow((occupied: boolean) => occupied)
  useEffect(() => {
    if (flowOpen && !flowAvailable) setFlowOpen(false)
  }, [flowOpen, flowAvailable])
  const footer: MenuEntry[] = [
    {
      id: PROJECTLESS,
      label: t('picker.projectless'),
      icon: <IconNewChatOutlineRegular size={16} />,
      disabled: busy,
    },
    ...flowAvailable ? [
      { type: 'separator' as const, id: 'projectless-separator' },
      {
      id: ADD_WORKSPACE,
      label: t('picker.addWorkspace'),
      icon: <IconPlusOutlineRegular size={16} />,
      disabled: busy,
      },
    ] : [],
  ]

  const run = (operation: () => Promise<void>): void => {
    if (busy) return
    setBusy(true)
    void operation().catch((reason: unknown) => {
      setModalError(errorMessage(reason))
    }).finally(() => {
      setBusy(false)
    })
  }

  const handleSelect = (id: string): void => {
    if (id === PROJECTLESS) {
      onClose()
      run(async () => { await createProjectlessSession() })
      return
    }
    if (id === ADD_WORKSPACE) {
      onClose()
      setModalError(null)
      setFlowOpen(true)
      return
    }
    onClose()
    run(() => selectWorkspace(id as WorkspaceId))
  }

  const directoryFlowOwner: DirectoryFlowOwnerProps = {
    open: flowOpen,
    busy,
    onPicked: path => {
      run(async () => {
        try {
          const workspace = await createWorkspace({ path })
          await selectWorkspace(workspace.workspaceId)
        } finally {
          setFlowOpen(false)
        }
      })
    },
    onCancel: () => { setFlowOpen(false) },
    onError: message => {
      setFlowOpen(false)
      setModalError(message)
    },
  }

  return (
    <>
      <Menu
        open={open}
        anchor={null}
        items={workspaceItems}
        footer={footer}
        selectedId={selection.selectedId ?? PROJECTLESS}
        onSelect={handleSelect}
        onClose={onClose}
        side="bottom"
        portal
        getAnchorRect={getAnchorRect}
      />
      {renderSlot(DIRECTORY_FLOW, directoryFlowOwner)}
      <Modal
        open={modalError !== null}
        onClose={() => { setModalError(null) }}
        closeLabel={t('modal.close')}
        title={t('modal.createFailed')}
        footer={(
          <Button variant="primary" onClick={() => { setModalError(null) }}>
            {t('modal.close')}
          </Button>
        )}
      >
        <div className="dsh-projectless-session-error" role="alert">{modalError}</div>
      </Modal>
    </>
  )
}

function ProjectlessEntry({ start, t }: PropsLocale<typeof PROJECTLESS_LOCALE_NS> & { start(): void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const entry = ref.current!
    const group = entry.closest<HTMLElement>('.dsh-projectless-chip-group')!
    const folder = group.querySelector<SVGElement>('.dsh-projectless-folder')!
    const align = () => {
      const parent = group.getBoundingClientRect()
      const icon = folder.getBoundingClientRect()
      entry.style.left = `${icon.left - parent.left}px`
      entry.style.top = `${icon.top - parent.top}px`
    }
    align()
    const observer = new ResizeObserver(align)
    observer.observe(group)
    observer.observe(folder)
    return () => { observer.disconnect() }
  }, [])
  return (
    <button ref={ref} type="button" onClick={event => { event.stopPropagation(); start() }}
      title={t('entry.new')} aria-label={t('entry.new')} className="dsh-projectless-entry">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </button>
  )
}

function installStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = PACKAGE_ID
  style.textContent = `
    .dsh-projectless-chip-group { display: inline-flex; align-items: center; position: relative; }
    .dsh-projectless-chip-group button.dsh-projectless-entry { position: absolute; z-index: 1; width: 16px !important; height: 16px !important;
      min-width: 16px !important; min-height: 16px !important; padding: 0 !important;
      display: inline-flex; align-items: center; justify-content: center; border: 0 !important; border-radius: 4px !important;
      background: var(--dsw-alias-interactive-bg-hover, #e2e4e7) !important; color: var(--dsw-alias-label-primary, inherit) !important;
      line-height: 1; cursor: pointer; opacity: 0 !important; pointer-events: none !important; }
    .dsh-projectless-chip-group:hover .dsh-projectless-entry,
    .dsh-projectless-chip-group .dsh-projectless-entry:focus { opacity: 1 !important; pointer-events: auto !important; }
    .dsh-projectless-chip-group:has(.dsh-projectless-entry):hover .dsh-projectless-folder,
    .dsh-projectless-chip-group:has(.dsh-projectless-entry:focus) .dsh-projectless-folder { visibility: hidden; }
    .dsh-projectless-settings { display: grid; gap: 8px; padding: 12px 0; }
    .dsh-projectless-settings-controls { display: flex; gap: 8px; }
    .dsh-projectless-settings input { flex: 1; min-width: 0; padding: 8px; color: inherit;
      background: transparent; border: 1px solid var(--dsw-alias-border-primary, #888); border-radius: 6px; }
    .dsh-projectless-settings small { overflow-wrap: anywhere; }
    .dsh-projectless-session-error {
      margin-top: 8px;
      color: var(--dsw-alias-state-error-primary);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
  `
  document.head.appendChild(style)
  return () => { style.remove() }
}

type LooseRegister = (options: Record<string, unknown>, component: unknown) => () => void

/**
 * DSH 0.2 lets exactly one entry declare a hole and render only holes it
 * declared, and the built-in picker already declares the hero directory-flow
 * hole. Re-register whatever occupies that hole (the native chooser or the
 * in-app browser) into this picker's own hole so "Add workspace…" keeps the
 * composed picking interaction.
 */
function mirrorDirectoryFlow(slots: SlotRegistry): () => void {
  const register = slots.register.bind(slots) as unknown as LooseRegister
  let mirrored: readonly StoredEntry[] | undefined
  let disposers: (() => void)[] = []
  const release = (): void => {
    for (const dispose of disposers) dispose()
    disposers = []
  }
  const sync = (): void => {
    const entries = slots.entries(DSH_DIRECTORY_FLOW)
    if (entries === mirrored) return
    mirrored = entries
    release()
    disposers = entries.map(entry => register({
      name: DIRECTORY_FLOW,
      ...entry.options.priority === undefined ? {} : { priority: entry.options.priority },
      ...entry.inject === undefined ? {} : { inject: entry.inject },
      ...entry.locale === undefined ? {} : { locale: entry.locale },
    }, entry.component))
  }
  const unsubscribe = slots.subscribe(DSH_DIRECTORY_FLOW, sync)
  sync()
  return () => {
    unsubscribe()
    release()
  }
}

export const name = PACKAGE_ID
export const inject = ['connection', 'locale', 'slots', 'sessions', 'workspaces', 'uiWorkspace', 'conversation', 'remote', 'remote.session', 'remote.agentPresets', 'remote.permissionPresets']

/**
 * DSH 0.2 split the old combined Workspace face: registrations live on
 * `ctx.workspaces`, blank-Session connection, navigation and archival on
 * `ctx.uiWorkspace`.
 */
function projectlessHost(ctx: Context) {
  const workspaces = ctx.workspaces
  const ui: UiWorkspace = ctx.uiWorkspace
  const sessions = {
    list: ctx.sessions.list,
    open: (sessionId: SessionId) => { ui.openSession(sessionId) },
  }
  const host = {
    list: workspaces.list,
    create: (input: { path: string }) => workspaces.create(input),
    delete: (workspaceId: WorkspaceId) => workspaces.delete(workspaceId),
    rename: (workspaceId: WorkspaceId, title: string) => workspaces.rename(workspaceId, title),
    connectWorkspace: (workspaceId: WorkspaceId) => ui.connectWorkspace(workspaceId),
    archiveSession: (sessionId: SessionId) => ui.archiveSession(sessionId),
  }
  return { host, sessions }
}

/** Install a priority -1 picker; DSH's built-in priority 0 picker remains the automatic fallback. */
export function apply(ctx: Context): void {
  const { host, sessions } = projectlessHost(ctx)
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`)
  ctx.effect(
    () => ctx.locale.register(PROJECTLESS_LOCALE_NS, projectlessLocales),
    `${PACKAGE_ID}: dictionaries`,
  )
  const registry = createProjectlessRegistry()
  const pendingWorkspaceIds = new Set<WorkspaceId>()
  const claim = createAbandonClaim()
  const rpc = ctx.connection.rpc as unknown as ClientConnectionRpc
  let diagnosticsEnabled = false
  let loggingFailed = false
  const diagnostics: DiagnosticSink = (event, fields = {}) => {
    if (!diagnosticsEnabled || loggingFailed) return
    console.debug(`[${PACKAGE_ID}] ${event}`, fields)
    try {
      void rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint('log-event'), { event, fields }).then(result => {
        if (!result.ok) throw new Error('diagnostic RPC failed')
      }).catch(() => { loggingFailed = true })
    } catch { loggingFailed = true }
  }
  const onError = (error: unknown): void => {
    console.error(error)
    diagnostics('client.failed', { code: diagnosticErrorCode(error) })
  }
  const removeDirectory = (path: string) => requestRemoveProjectlessDirectory(rpc, path)
  const isProjectlessWorkspace = (workspace: WorkspaceView): boolean => (
    pendingWorkspaceIds.has(workspace.workspaceId) || registry.has(workspace.workspaceId) || isProjectlessPath(workspace.path)
  )
  const directoryFlow: HostObservable<boolean> = {
    getSnapshot: () => ctx.slots.entries(DIRECTORY_FLOW).length > 0,
    subscribe: (listener: () => void) => ctx.slots.subscribe(DIRECTORY_FLOW, listener),
  }
  ctx.effect(() => {
    let disposed = false
    let stopSweep = (): void => {}
    void requestProjectlessSettings(rpc).then(settings => {
      if (disposed) return
      diagnosticsEnabled = settings.diagnosticsEnabled
      stopSweep = sweepAbandonedProjectlessWorkspaces(
        host,
        sessions,
        settings.root,
        removeDirectory,
        pendingWorkspaceIds,
        claim,
        onError,
        diagnostics,
      )
    }).catch(onError)
    return () => {
      disposed = true
      stopSweep()
    }
  }, `${PACKAGE_ID}: sweep leftover unused workspaces`)
  const drafts = installProjectlessDrafts(ctx, host, pendingWorkspaceIds, diagnostics, onError)
  ctx.on('projectless/is-session', drafts.isProjectlessSession)
  ctx.on('projectless/label', () => ctx.locale.bind(PROJECTLESS_LOCALE_NS)('picker.projectless'))
  ctx.slots.inject('projectless.entry', () => ctx.slots.register({
    name: 'projectless.entry',
    locale: PROJECTLESS_LOCALE_NS,
    inject: () => ({ start: () => { void drafts.start().catch(onError) } }),
  }, ProjectlessEntry))
  ctx.effect(() => (ctx.slots.register.bind(ctx.slots) as unknown as LooseRegister)({
    name: 'settings.general.item', id: 'projectless-session', order: 0,
    locale: PROJECTLESS_LOCALE_NS,
    inject: () => ({ rpc, browse: () => ctx.uiWorkspace.pickDirectory() }),
  }, ProjectlessSettings), `${PACKAGE_ID}: root settings`)
  const actions = (): PickerActions => ({
    createWorkspace: input => host.create(input),
    selectWorkspace: drafts.switchWorkspace,
    isProjectlessWorkspace,
    hooks: { directoryFlow },
    createProjectlessSession: drafts.start,
  })

  ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register(
    {
      name: 'conversation.hero.workspace',
      priority: -1,
      children: {
        [DIRECTORY_FLOW]: { kind: 'single', scope: 'root' },
      },
      inject: actions,
      locale: PROJECTLESS_LOCALE_NS,
    },
    ProjectlessWorkspacePicker,
  ))
  ctx.slots.inject(DIRECTORY_FLOW, () => mirrorDirectoryFlow(ctx.slots))
}
