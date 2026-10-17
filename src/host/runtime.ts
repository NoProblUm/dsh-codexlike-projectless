import type { Context } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NativeTitleBridge, PreparedTitle } from '../shared/native.ts'
import { ADAPTER_ID, RUNTIME_PACKAGE_VERSION, originalInstance, wrapRuntimeMethod, type RuntimeStatus } from '../shared/runtime.ts'

export function activateHostRuntime(ctx: Context): { status: RuntimeStatus, title?: NativeTitleBridge } {
  const status: RuntimeStatus = { state: 'checking', reason: '正在检查宿主兼容性', adapter: ADAPTER_ID, version: RUNTIME_PACKAGE_VERSION }
  const disposers: (() => void)[] = []
  let active = true
  try {
    const archive = process.argv.map(arg => /^(.*?\.asar)(?:[/\\]|$)/i.exec(arg)?.[1]).find(Boolean)
    if (process.platform !== 'win32' || !archive) throw new Error('仅支持已验证的 Windows Desktop 0.2.0-rc.2 构建')
    const manifest = JSON.parse(readFileSync(join(archive, 'package.json'), 'utf8'))
    if (manifest.version !== '0.2.0-rc.2' || manifest.dshBuildCommit !== '04f392c9ddd144fa426da2045178797da6db6c11') throw new Error('宿主构建不在支持范围内')
    for (const [path, expected] of Object.entries(TARGET_MODULES)) {
      const bytes = readFileSync(join(archive, 'dsh/node_modules/@deepseek-ai', path))
      if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('宿主模块不匹配或仍安装旧归档补丁：' + path)
    }
    const service = originalInstance((ctx as any).sessionTitle) as any
    for (const key of ['onUserMessage', 'assertServiceActive', 'track', 'validateResult']) {
      if (typeof service[key] !== 'function') throw new Error('标题服务缺少必要能力：' + key)
    }
    const prepared = new Map<string, any>()
    const bound = new Map<string, any>()
    disposers.push(wrapRuntimeMethod(service, 'onUserMessage', (original, receiver, args) => {
      const [session, event] = args
      const item = bound.get(session.id)
      if (!item) return original.apply(receiver, args)
      bound.delete(session.id)
      Promise.resolve().then(() => {
        if (!active || !receiver.serviceActive() || receiver.ctx.sessions.get(session.id) !== session) return
        for (const [type, data] of item.events) session.append(type, { ...data, messageSeqs: [event.seq] })
        session.append('session/title', { title: item.title, messageSeqs: [event.seq], source: item.source })
      })
    }))
    const title: NativeTitleBridge = {
      async prepareProjectlessTitle(text, route, sessionId, signal): Promise<PreparedTitle> {
        if (!active) throw new Error('Runtime adapter disposed')
        service.assertServiceActive()
        const events: [string, unknown][] = []
        const messages = [{ seq: 0, text }]
        let result: any
        let source: any = { kind: 'fallback' }
        const registration = service.registration
        if (registration && !registration.closing) {
          try {
            result = await service.track(registration.provider.generate({ session: { id: sessionId, append: (type: string, data: unknown) => events.push([type, data]) }, messages, route, signal: AbortSignal.any([signal, service.lifetime.signal]) }), registration)
            result = service.validateResult(result, messages)
            source = { kind: 'provider', provider: registration.provider.id, ...result.model ? { model: result.model } : {} }
          } catch (error) {
            signal.throwIfAborted()
            service.lifetime.signal.throwIfAborted()
            service.ctx.logger.warn('projectless title provider failed; using native fallback: ' + String(error))
          }
        }
        signal.throwIfAborted()
        if (!active) throw new Error('Runtime adapter disposed')
        const { fallbackSessionTitle } = await import('@deepseek-ai/dsh-session-title')
        const textTitle = result?.title ?? (fallbackSessionTitle(text, service.config.fallbackMaxWords, service.config.fallbackMaxBytes) || 'Untitled')
        const token = crypto.randomUUID()
        for (const [key, item] of prepared) if (item.expires < Date.now()) prepared.delete(key)
        if (prepared.size >= 64) throw new Error('Too many pending projectless titles')
        prepared.set(token, { sessionId, title: textTitle, source, events, expires: Date.now() + 300000 })
        return { token, title: textTitle, sessionId: sessionId as PreparedTitle['sessionId'], source: source.kind }
      },
      bindProjectlessTitle(sessionId, token) {
        const item = prepared.get(token)
        if (!active || !item || item.sessionId !== sessionId || item.expires < Date.now()) throw new Error('Prepared title expired or belongs to another Session')
        if (!service.ctx.sessions.get(sessionId)) throw new Error('Final Session does not exist')
        prepared.delete(token)
        bound.set(sessionId, item)
      },
    }
    ctx.effect(() => () => { active = false; prepared.clear(); bound.clear(); for (const dispose of disposers.reverse()) dispose() })
    status.state = 'ready'
    status.reason = '宿主运行时适配已就绪'
    return { status, title }
  } catch (error) {
    active = false
    for (const dispose of disposers.reverse()) dispose()
    status.state = 'unsupported'
    status.reason = error instanceof Error ? error.message : String(error)
    return { status }
  }
}

// Byte fingerprints of the five original modules in the verified rc.2 archive.
// Generated from original SHA-256 983ca71114e6dfd353fc79af5a1f9481a250ee64c2a3c757673029b811b23bc2.
const TARGET_MODULES: Record<string, string> = {
  'dsh-api-session-controller/lib/client.js': '60ec6a006443b40e5ab718f3fa53c301559c5c28427ca650c3851127ce370d43',
  'dsh-api-gateway/lib/client.js': 'e09e26fcd4849cd55683b9cc702dca896efce93a5af3968431c1c8a62147b9cf',
  'dsh-client-ui-conversation/lib/client.js': '64843c950b829f44feed3248af6c46bbd620cf85e7c687b4f7f60e1ec4eb4782',
  'dsh-client-ui-workspace/lib/client.js': '29c34ce1c2a437cf8a50ba35d1ae44741114439e37a17153dfd4b1aa942aa955',
  'dsh-session-title/lib/index.js': '9701b041939fe0bf153f90e94092940720b735fc96aa85ef4a0f902f9c15ff11',
}
