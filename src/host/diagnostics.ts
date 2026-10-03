import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DiagnosticSink } from '../shared/diagnostics.ts'

/** Opt-in JSONL writer. A logging failure must never fail a user operation. */
export function createDiagnosticLogger(
  file: string,
  enabled: boolean,
  onError: (error: unknown) => void = () => {},
): { emit: DiagnosticSink, flush(): Promise<void> } {
  let writes = Promise.resolve()
  let failed = false
  let sequence = 0
  const emit: DiagnosticSink = (event, fields = {}) => {
    if (!enabled || failed) return
    const line = JSON.stringify({ time: new Date().toISOString(), sequence: ++sequence, event, ...fields }) + '\n'
    writes = writes.then(async () => {
      if (failed) return
      await mkdir(dirname(file), { recursive: true })
      await appendFile(file, line, { encoding: 'utf8', mode: 0o600 })
    }).catch(error => {
      failed = true
      try { onError(error) } catch { /* Diagnostics remain best-effort. */ }
    })
  }
  return { emit, flush: () => writes }
}
