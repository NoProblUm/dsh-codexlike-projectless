import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyNativeAdmission, matchesNativeSubmission } from '../src/client/admission.ts'

test('rc.2 carrier failures and cancellation remain unknown after a native request exists', () => {
  for (const errorCode of ['gateway/internal', 'gateway/cancelled', 'carrier/disconnected']) {
    assert.equal(classifyNativeAdmission({ requestId: 'request-1', accepted: false, observed: false, errorCode }, { kind: 'error' }), 'unknown')
  }
  assert.equal(classifyNativeAdmission({ requestId: 'request-1', accepted: false, observed: false }, { kind: 'error' }), 'unknown')
})

test('only this operation admission or matching durable observation overrides an error', () => {
  assert.equal(classifyNativeAdmission({ requestId: 'request-1', accepted: true, observed: false, errorCode: 'gateway/internal' }, { kind: 'error' }), 'accepted')
  assert.equal(classifyNativeAdmission({ requestId: 'request-1', accepted: false, observed: true, errorCode: 'gateway/internal' }, { kind: 'error' }), 'accepted')
  assert.equal(classifyNativeAdmission({ requestId: 'request-1', accepted: false, observed: false, errorCode: 'session/attachment-invalid' }, { kind: 'error' }), 'rejected')
  assert.equal(classifyNativeAdmission({ accepted: false, observed: false }, { kind: 'error' }), 'rejected')
})

test('durable observation requires the exact native user-message request identity', () => {
  assert.equal(matchesNativeSubmission('request-1', { source: { kind: 'user', rpcId: 'request-1' } }), true)
  assert.equal(matchesNativeSubmission('request-1', { source: { kind: 'user', rpcId: 'request-2' } }), false)
  assert.equal(matchesNativeSubmission('request-1', { source: { kind: 'assistant', rpcId: 'request-1' } }), false)
  assert.equal(matchesNativeSubmission(undefined, { source: { kind: 'user' } }), false)
})
