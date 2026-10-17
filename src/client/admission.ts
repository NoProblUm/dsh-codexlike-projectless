import type { PromptAcceptance } from './first-prompt.ts'

export interface NativeAdmission {
  requestId?: string
  accepted: boolean
  observed: boolean
  errorCode?: string
}

export function matchesNativeSubmission(requestId: string | undefined, message: { source?: { kind?: string, rpcId?: string } }): boolean {
  return requestId !== undefined && message.source?.kind === 'user' && message.source.rpcId === requestId
}

/** rc.2 folds transport failures into gateway/internal, not carrier/*. */
export function classifyNativeAdmission(admission: NativeAdmission | undefined, outcome: { kind: string }): PromptAcceptance {
  if (admission?.accepted || admission?.observed || outcome.kind === 'success') return 'accepted'
  if (!admission?.requestId) return 'rejected'
  if (!admission.errorCode || admission.errorCode.startsWith('gateway/') || admission.errorCode.startsWith('carrier/') || admission.errorCode.includes('cancel')) return 'unknown'
  return 'rejected'
}
