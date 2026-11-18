type StagedAttachment = { kind: 'file' | 'image' }
type UploadOperation = { controller: AbortController, done: Promise<void> }

interface ConversationUploads {
  draftAttachments: ReadonlyMap<string, StagedAttachment>
  fileUploadOperations: ReadonlyMap<string, UploadOperation>
  beginFileUpload(sessionId: string, attachment: StagedAttachment): void
}

export async function uploadDeferredAttachments(
  conversation: ConversationUploads,
  sessionId: string,
  ids: readonly string[],
  deferred: ReadonlyMap<string, string>,
  signal?: AbortSignal,
): Promise<void> {
  const pending: Promise<void>[] = []
  for (const id of ids) {
    if (!deferred.has(id)) continue
    const attachment = conversation.draftAttachments.get(id)
    if (!attachment) continue
    signal?.throwIfAborted()
    conversation.beginFileUpload(sessionId, attachment)
    const operation = conversation.fileUploadOperations.get(id)!
    const abort = () => operation.controller.abort(signal?.reason)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    pending.push(operation.done.finally(() => signal?.removeEventListener('abort', abort)))
  }
  await Promise.all(pending)
  signal?.throwIfAborted()
}
