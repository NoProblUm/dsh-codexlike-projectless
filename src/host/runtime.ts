import type { Context } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NativeTitleBridge, PreparedTitle } from '../shared/native.ts'
import { ADAPTER_ID, RUNTIME_PACKAGE_VERSION, TARGET_BUILD, originalInstance, wrapRuntimeMethod, type RuntimeStatus } from '../shared/runtime.ts'

const installations = new WeakMap<object, { status: RuntimeStatus, title: NativeTitleBridge }>()
export function activateHostRuntime(ctx: Context): { status: RuntimeStatus, title?: NativeTitleBridge } {
  const key = originalInstance((ctx as any).sessionTitle)
  const existing = key && installations.get(key)
  if (existing) return existing
  const status: RuntimeStatus = { state: 'checking', reason: '正在检查宿主兼容性', adapter: ADAPTER_ID, version: RUNTIME_PACKAGE_VERSION, build: TARGET_BUILD, missingCapabilities: [] }
  const disposers: (() => void)[] = []
  let active = true
  try {
    const archive = process.argv.map(arg => /^(.*?\.asar)(?:[/\\]|$)/i.exec(arg)?.[1]).find(Boolean)
    if (process.platform !== 'win32' || !archive) throw new Error('仅支持已验证的 Windows Desktop 0.2.1-rc.3 构建')
    const manifest = JSON.parse(readFileSync(join(archive, 'package.json'), 'utf8'))
    status.build = manifest.dshBuildCommit ?? 'unknown'
    if (manifest.version !== '0.2.1-rc.3' || manifest.dshBuildCommit !== TARGET_BUILD || manifest.dshBuildDirty !== false) throw new Error('宿主构建不在支持范围内')
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
    ctx.effect(() => () => { active = false; prepared.clear(); bound.clear(); for (const dispose of disposers.reverse()) dispose(); installations.delete(key) })
    status.state = 'ready'
    status.reason = '宿主运行时适配已就绪'
    const runtime = { status, title }
    installations.set(key, runtime)
    return runtime
  } catch (error) {
    active = false
    for (const dispose of disposers.reverse()) dispose()
    status.state = 'unsupported'
    status.reason = error instanceof Error ? error.message : String(error)
    status.missingCapabilities = [status.reason]
    return { status }
  }
}

// Byte fingerprints of the original modules in the verified rc.3 archive.
// Generated from original SHA-256 04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0.
const TARGET_MODULES: Record<string, string> = {
  'dsh-client-file-upload/lib/client.js': '4c09378ab7cb3dbe58253bd1fad8c4a00ebf5a93b462d96623edb7bd4e566305',
  'dsh-api-gateway/lib/client.browser.js': '3043de82334846a3a5654b7317830c5403f90e9aeca692d3c15e30e01d16505d',
  'dsh-api-session-controller/lib/client.js': '82f2301c18f0e51340c1eedf8ecdfb939e873b3770a80632e438b86e82887d0e',
  'dsh-api-gateway/lib/index.js': '4fbe460fec585ebc2cf2887261f6c33f024081a539d9fb5d6557a9002324b23f',
  'dsh-client-ui-conversation/lib/client.js': 'c151e7acb17eab9018939eff3b093a4cc4983e0c3cea5eba7ac858dbf8a3eb84',
  'dsh-client-ui-workspace/lib/client.js': 'bafd2d6eea2f82674cc0606bec13fc891e44b42fb2ac973f01cb32c735d4062f',
  'dsh-session-title/lib/index.js': 'eb814490ca3d0aaabf8f6ddc705a031f99a98709c484c1502c5f28f101cf0eeb',
}
