import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { diagnosticErrorCode, noDiagnostics, type DiagnosticSink } from '../shared/diagnostics.ts'
import {
  abandonUnusedProjectlessWorkspace,
  type ProjectlessRegistry,
  type ProjectlessSessionHost,
  type ProjectlessSessionReceipt,
  type SessionNavigator,
} from './session.ts'

export type PromptAcceptance = 'accepted' | 'rejected' | 'unknown'

/** Adapter to native draft input, title preparation and admission. */
export interface FirstPromptServices<Input, PreparedTitle extends { title: string }> {
  prepareTitle(input: Input): Promise<PreparedTitle>
  createSession?(workspaceId: WorkspaceId, title: PreparedTitle): Promise<SessionId>
  provisionDirectory(title: string): Promise<string>
  bindPreparedTitle(sessionId: SessionId, title: PreparedTitle): Promise<void>
  send(sessionId: SessionId, input: Input): Promise<PromptAcceptance>
  removeDirectory(path: string): Promise<void>
  isCurrentTarget(): boolean
  onError(error: unknown): void
}

/**
 * Title preparation precedes directory allocation and final Session creation.
 */
export async function createAndSendProjectlessSession<Input, PreparedTitle extends { title: string }>(
  host: ProjectlessSessionHost,
  sessions: SessionNavigator,
  input: Input,
  services: FirstPromptServices<Input, PreparedTitle>,
  registry: Pick<ProjectlessRegistry, 'remember'>,
  pending: Set<WorkspaceId>,
  diagnostics: DiagnosticSink = noDiagnostics,
): Promise<{ receipt: ProjectlessSessionReceipt, acceptance: PromptAcceptance }> {
  diagnostics('title.preparation.started')
  const title = await services.prepareTitle(input)
  diagnostics('title.preparation.finished')
  const path = await services.provisionDirectory(title.title)
  let workspace
  try {
    workspace = await host.create({ path })
  } catch (error) {
    await services.removeDirectory(path).catch(services.onError)
    throw error
  }
  registry.remember(workspace.workspaceId)
  pending.add(workspace.workspaceId)
  diagnostics('workspace.registered', { workspaceId: workspace.workspaceId, path })
  let receipt: ProjectlessSessionReceipt | undefined
  let sending = false
  let protectPending = false
  try {
    const sessionId = services.createSession === undefined
      ? await host.connectWorkspace(workspace.workspaceId)
      : await services.createSession(workspace.workspaceId, title)
    receipt = { sessionId, workspaceId: workspace.workspaceId, path }
    diagnostics('session.created', { sessionId, workspaceId: workspace.workspaceId, path })
    await services.bindPreparedTitle(sessionId, title)
    sending = true
    const acceptance = await services.send(sessionId, input)
    diagnostics(`prompt.${acceptance}`, { sessionId, workspaceId: workspace.workspaceId })
    if (acceptance === 'unknown') {
      protectPending = true
      return { receipt, acceptance }
    }
    if (acceptance === 'rejected') {
      await abandonUnusedProjectlessWorkspace(host, {
        ...receipt, sessionIds: [sessionId],
      }, services.removeDirectory, services.onError, diagnostics)
      return { receipt, acceptance }
    }
    try {
      await host.delete(workspace.workspaceId)
      diagnostics('workspace.detached', { sessionId, workspaceId: workspace.workspaceId })
    } catch (error) {
      diagnostics('workspace.detach.failed', { sessionId, workspaceId: workspace.workspaceId, code: diagnosticErrorCode(error) })
      services.onError(error)
    }
    try {
      if (services.isCurrentTarget()) {
        sessions.open(sessionId)
        diagnostics('session.opened', { sessionId, workspaceId: workspace.workspaceId })
      }
    } catch (error) {
      diagnostics('client.failed', { sessionId, code: diagnosticErrorCode(error) })
      services.onError(error)
    }
    return { receipt, acceptance }
  } catch (error) {
    if (sending && receipt !== undefined) {
      // Transport failures may hide an accepted prompt. Keep resources and the
      // pending guard until the native caller reconciles admission by requestId.
      diagnostics('prompt.unknown', { sessionId: receipt.sessionId, workspaceId: workspace.workspaceId, code: diagnosticErrorCode(error) })
      protectPending = true
      services.onError(error)
      return { receipt, acceptance: 'unknown' }
    }
    diagnostics('session.creation.failed', { workspaceId: workspace.workspaceId, code: diagnosticErrorCode(error) })
    await abandonUnusedProjectlessWorkspace(host, {
      workspaceId: workspace.workspaceId, path, sessionIds: receipt === undefined ? [] : [receipt.sessionId],
    }, services.removeDirectory, services.onError, diagnostics)
    throw error
  } finally {
    // Unknown admission must remain protected from the blank-workspace sweep.
    if (!protectPending) pending.delete(workspace.workspaceId)
  }
}
