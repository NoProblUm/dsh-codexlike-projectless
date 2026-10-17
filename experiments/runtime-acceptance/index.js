import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
export const name = 'dsh-runtime-acceptance'
export const inject = ['llm', 'sessions']
export function apply(ctx) {
  const root = process.env.DSH_HOME
  if (!root?.includes('runtime-candidate')) throw new Error('Acceptance fixture requires its isolated test home')
  mkdirSync(root, { recursive: true })
  ctx.on('llm/stream', options => (async function* () {
    const session = ctx.sessions.get(options.sessionId)
    appendFileSync(join(root, 'model-events.jsonl'), JSON.stringify({ purpose: options.purpose, sessionId: options.sessionId, sessionExists: !!session, provider: options.provider, model: options.model, messages: options.messages }) + '\n')
    const text = options.purpose === 'session-title' ? '运行时首发验证' : '隔离测试模型已收到原生提交。'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  })(), { prepend: true, global: true })
}
