import assert from 'node:assert/strict'
import test from 'node:test'
import { uploadDeferredAttachments } from '../src/client/attachments.ts'

test('first send uploads staged files and images in the real session before native send', async () => {
  const file = { kind: 'file', id: 'text' } as const
  const image = { kind: 'image', id: 'png' } as const
  const inlineImage = { kind: 'image', id: 'inline' } as const
  const draftAttachments = new Map([file, image, inlineImage].map(attachment => [attachment.id, attachment]))
  const deferred = new Map([['text', 'local-draft'], ['png', 'local-draft']])
  const fileUploadOperations = new Map<string, { controller: AbortController, done: Promise<void> }>()
  const completions = new Map<string, () => void>()
  const uploads: [string, string][] = []
  const conversation = {
    draftAttachments, fileUploadOperations,
    beginFileUpload(sessionId: string, attachment: typeof file | typeof image | typeof inlineImage) {
      uploads.push([sessionId, attachment.id])
      const upload = Promise.withResolvers<void>()
      completions.set(attachment.id, upload.resolve)
      fileUploadOperations.set(attachment.id, { controller: new AbortController(), done: upload.promise })
    },
  }
  let ready = false
  const settling = uploadDeferredAttachments(conversation, 'real-session', ['png', 'inline', 'text'], deferred).then(() => { ready = true })
  assert.deepEqual(uploads, [['real-session', 'png'], ['real-session', 'text']])
  completions.get('text')!()
  await Promise.resolve()
  assert.equal(ready, false)
  completions.get('png')!()
  await settling
  assert.equal(ready, true)
})

test('cancelling the first send aborts a deferred image upload', async () => {
  const image = { kind: 'image' } as const
  const upload = new AbortController()
  const send = new AbortController()
  const settled = Promise.withResolvers<void>()
  upload.signal.addEventListener('abort', () => settled.resolve(), { once: true })
  const conversation = {
    draftAttachments: new Map([['png', image]]),
    fileUploadOperations: new Map<string, { controller: AbortController, done: Promise<void> }>(),
    beginFileUpload() {
      this.fileUploadOperations.set('png', { controller: upload, done: settled.promise })
    },
  }
  const result = uploadDeferredAttachments(conversation, 'real-session', ['png'], new Map([['png', 'local-draft']]), send.signal)
  const cancelled = new Error('cancelled')
  send.abort(cancelled)
  await assert.rejects(result, cancelled)
  assert.equal(upload.signal.reason, cancelled)
})
