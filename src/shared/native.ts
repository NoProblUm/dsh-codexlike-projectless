import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ISessions, SessionFace } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IConversation, DraftAttachmentId, SubmitOutcome } from '@deepseek-ai/dsh-client-ui-conversation/client'

export interface PreparedTitle {
  title: string
  token: string
  sessionId: SessionId
  source: 'provider' | 'fallback'
}

export interface NativeTitleBridge {
  prepareProjectlessTitle(text: string, route: { provider: string, model: string }, sessionId: string, signal: AbortSignal): Promise<PreparedTitle>
  bindProjectlessTitle(sessionId: string, token: string): void
}

export type DraftSessions = ISessions & {
  createProjectlessDraft(values: Record<string, unknown>): SessionId
  isProjectlessDraft(id: SessionId): boolean
  updateProjectlessDraft(id: SessionId, key: string, value: unknown): void
  discardProjectlessDraft(id: SessionId): void
}

export type NativeConversation = IConversation & {
  sendSession(session: SessionFace, text: string, attachmentIds: readonly DraftAttachmentId[], mode: 'queue' | 'steer', signal: AbortSignal): Promise<SubmitOutcome & { remoteError?: { code: string, message: string } }>
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'projectless/label'(): string | undefined
    'projectless/new-session'(workspaceId?: import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceId, currentSessionId?: SessionId): true | undefined
    'projectless/select-workspace'(workspaceId: import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceId): Promise<void> | undefined
    'projectless/is-session'(sessionId: SessionId): boolean | undefined
    'projectless/first-send'(session: SessionFace, text: string, attachmentIds: readonly DraftAttachmentId[], mode: 'queue' | 'steer', signal: AbortSignal): Promise<SubmitOutcome> | undefined
    'projectless/draft-rpc'(endpoint: string, args: readonly unknown[], signal: AbortSignal): Promise<unknown> | undefined
  }
}
