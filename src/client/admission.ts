import type { BeginSubmissionInput, SubmissionHandle } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PromptAcceptance } from './first-prompt.ts'

export interface NativeAdmission {
  requestId?: string
  dispatched: boolean
  accepted: boolean
  observed: boolean
  errorCode?: string
}

export function trackNativeSubmission(admission: NativeAdmission, begin: (input: BeginSubmissionInput) => SubmissionHandle, input: BeginSubmissionInput): SubmissionHandle {
  const submission = begin({
    ...input,
    onAccept() {
      admission.accepted = true
      input.onAccept?.()
    },
    onRetire(settlement) {
      if (settlement.reason === 'observed') admission.observed = true
      input.onRetire?.(settlement)
    },
  })
  admission.requestId = submission.requestId
  return submission
}

export function matchesNativeSubmission(requestId: string | undefined, message: { source?: { kind?: string, rpcId?: string } }): boolean {
  return requestId !== undefined && message.source?.kind === 'user' && message.source.rpcId === requestId
}

export function classifyNativeAdmission(admission: NativeAdmission | undefined, outcome: { kind: string }): PromptAcceptance {
  if (admission?.accepted || admission?.observed || outcome.kind === 'success') return 'accepted'
  if (!admission?.dispatched) return 'rejected'
  if (!admission.errorCode || admission.errorCode.startsWith('gateway/') || admission.errorCode.startsWith('carrier/') || admission.errorCode.includes('cancel')) return 'unknown'
  return 'rejected'
}
