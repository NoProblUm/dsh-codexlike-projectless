import assert from 'node:assert/strict'
import test from 'node:test'
import type { BeginSubmissionInput, SubmissionHandle } from '@deepseek-ai/dsh-api-session-controller/client'
import { classifyNativeAdmission, matchesNativeSubmission, trackNativeSubmission, type NativeAdmission } from '../src/client/admission.ts'

const dispatched = { requestId: 'request-1', dispatched: true, accepted: false, observed: false }

test('carrier failures and cancellation remain unknown after a native request is dispatched', () => {
  for (const errorCode of ['gateway/internal', 'gateway/cancelled', 'carrier/disconnected']) {
    assert.equal(classifyNativeAdmission({ ...dispatched, errorCode }, { kind: 'error' }), 'unknown')
  }
  assert.equal(classifyNativeAdmission(dispatched, { kind: 'error' }), 'unknown')
})

test('only this operation admission or matching durable observation overrides an error', () => {
  assert.equal(classifyNativeAdmission({ ...dispatched, accepted: true, errorCode: 'gateway/internal' }, { kind: 'error' }), 'accepted')
  assert.equal(classifyNativeAdmission({ ...dispatched, observed: true, errorCode: 'gateway/internal' }, { kind: 'error' }), 'accepted')
  assert.equal(classifyNativeAdmission({ ...dispatched, errorCode: 'session/attachment-invalid' }, { kind: 'error' }), 'rejected')
  assert.equal(classifyNativeAdmission({ ...dispatched, dispatched: false }, { kind: 'error' }), 'rejected')
})

test('native acceptance can settle admission before the prompt RPC returns', () => {
  const admission: NativeAdmission = { dispatched: false, accepted: false, observed: false }
  let callbacks: BeginSubmissionInput | undefined
  const handle: SubmissionHandle = { requestId: 'request-1' as SubmissionHandle['requestId'], abandon() {} }
  const observed: string[] = []
  assert.equal(trackNativeSubmission(admission, input => {
    callbacks = input
    return handle
  }, {
    mode: 'queue', text: 'first prompt', attachments: [],
    onAccept() { observed.push('native accepted') },
    onRetire(settlement) { observed.push(settlement.reason) },
  }), handle)
  assert.equal(admission.requestId, handle.requestId)
  assert.equal(classifyNativeAdmission(admission, { kind: 'error' }), 'rejected', 'serialization can fail before dispatch')

  admission.dispatched = true
  assert.equal(classifyNativeAdmission(admission, { kind: 'error' }), 'unknown')
  callbacks?.onAccept?.()
  assert.equal(admission.observed, false)
  assert.equal(classifyNativeAdmission(admission, { kind: 'error' }), 'accepted')
  callbacks?.onRetire?.({ reason: 'observed', attachments: [] })
  assert.equal(admission.observed, true)
  assert.deepEqual(observed, ['native accepted', 'observed'])
})

test('durable observation requires the exact native user-message request identity', () => {
  assert.equal(matchesNativeSubmission('request-1', { source: { kind: 'user', rpcId: 'request-1' } }), true)
  assert.equal(matchesNativeSubmission('request-1', { source: { kind: 'user', rpcId: 'request-2' } }), false)
  assert.equal(matchesNativeSubmission('request-1', { source: { kind: 'assistant', rpcId: 'request-1' } }), false)
  assert.equal(matchesNativeSubmission(undefined, { source: { kind: 'user' } }), false)
})
