/** Diagnostic events deliberately exclude prompts, attachments and model credentials. */
export const DIAGNOSTIC_EVENTS = [
  'rpc.started', 'rpc.finished', 'rpc.failed',
  'directory.created', 'directory.removed', 'directory.retained',
  'session.creation.started', 'workspace.registered', 'session.created',
  'session.opened', 'session.creation.failed', 'session.rollback.failed',
  'title.preparation.started', 'title.preparation.finished',
  'prompt.accepted', 'prompt.rejected', 'prompt.unknown',
  'workspace.detached', 'workspace.detach.failed', 'session.abandoned',
  'diagnostics.enabled',
  'client.failed',
] as const

export type DiagnosticEvent = typeof DIAGNOSTIC_EVENTS[number]
export interface DiagnosticFields {
  rpcId?: string
  sessionId?: string
  workspaceId?: string
  path?: string
  endpoint?: string
  code?: string
}
export type DiagnosticSink = (event: DiagnosticEvent, fields?: DiagnosticFields) => void
export const noDiagnostics: DiagnosticSink = () => {}

/** Only accept the small metadata contract, never arbitrary client payloads. */
export function diagnosticPayload(value: unknown): { event: DiagnosticEvent, fields: DiagnosticFields } | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const payload = value as Record<string, unknown>
  if (!DIAGNOSTIC_EVENTS.includes(payload.event as DiagnosticEvent)) return undefined
  if (typeof payload.fields !== 'object' || payload.fields === null) return undefined
  const input = payload.fields as Record<string, unknown>
  const fields: DiagnosticFields = {}
  for (const key of ['rpcId', 'sessionId', 'workspaceId', 'path', 'endpoint', 'code'] as const) {
    if (input[key] === undefined) continue
    if (typeof input[key] !== 'string' || input[key].length > 4096) return undefined
    fields[key] = input[key]
  }
  return { event: payload.event as DiagnosticEvent, fields }
}

/** Error codes are useful without copying potentially sensitive error messages. */
export function diagnosticErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 80)
  }
  return error instanceof Error ? error.name : 'UnknownError'
}
