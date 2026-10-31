import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
export const name = 'dsh-runtime-acceptance'
export const inject = ['llm', 'sessions']
export function apply(ctx) {
  const root = process.env.DSH_HOME
  if (!root?.includes('runtime-candidate')) throw new Error('Acceptance fixture requires its isolated test home')
  mkdirSync(root, { recursive: true })
  class FixtureAdapter extends LlmAdapter {
    providerInfo(id) { return { id, name: 'Isolated fixture' } }
    async listModels() {
      appendFileSync(join(root, 'catalog-events.jsonl'), JSON.stringify({ event: 'listModels', fail: process.env.DSH_FIXTURE_CATALOG_FAIL === '1' }) + '\n')
      if (process.env.DSH_FIXTURE_CATALOG_FAIL === '1') throw new Error('Fixture model catalog failure')
      return [{ provider: 'fixture', id: 'fixture', name: 'Fixture', inputModalities: ['text', 'image'] }]
    }
    async resolveModel(provider, model) { return { provider, id: model, name: 'Fixture', context: { contextWindow: 65536 }, inputModalities: ['text', 'image'] } }
    async *stream() { throw new Error('Fixture stream interceptor missing') }
  }
  ctx.llm.registerAdapter(['fixture'], new FixtureAdapter())
  ctx.on('llm/stream', options => (async function* () {
    const session = ctx.sessions.get(options.sessionId)
    appendFileSync(join(root, 'model-events.jsonl'), JSON.stringify({ purpose: options.purpose, sessionId: options.sessionId, sessionExists: !!session, provider: options.provider, model: options.model, messages: options.messages }) + '\n')
    if (options.purpose === 'session-title' && JSON.stringify(options.messages).includes('fixture:title-fail')) throw new Error('Fixture title provider failure')
    const text = options.purpose === 'session-title' ? '运行时首发验证' : '隔离测试模型已收到原生提交。'
    const mode = /fixture:reasoning:(normal|signature|split|unclosed|empty)/.exec(JSON.stringify(options.messages))?.[1]
    let index = 0
    if (options.purpose !== 'session-title' && mode) {
      const parts = mode === 'normal' ? ['普通思考正文'] : mode === 'signature' ? ['<signature>fixture-secret</signature>\n可见思考正文'] : mode === 'split' ? ['<sig', 'nature>fixture-secret', '</sign', 'ature>\n', '可见思考正文'] : mode === 'unclosed' ? ['<signature>fixture-secret'] : ['<signature>fixture-secret</signature>\n']
      yield { type: 'block-start', index, blockType: 'reasoning' }
      for (const part of parts) {
        yield { type: 'reasoning-delta', index, text: part }
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      yield { type: 'block-end', index, block: { type: 'reasoning', text: parts.join('') } }
      index++
    }
    yield { type: 'block-start', index, blockType: 'text' }
    yield { type: 'text-delta', index, text }
    yield { type: 'block-end', index, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  })(), { prepend: true, global: true })
}
