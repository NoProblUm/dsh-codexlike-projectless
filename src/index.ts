import { homedir } from 'node:os'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import {
  createProjectlessDirectory,
  createTopicDirectory,
  removeUnusedProjectlessDirectory,
  resolveProjectlessRoot,
} from './host/directories.ts'
import {
  PROJECTLESS_ENDPOINTS,
  PROJECTLESS_RPC_CHANNEL,
  projectlessEndpoint,
  type ProjectlessEndpoint,
} from './shared/rpc.ts'
import { createDiagnosticLogger } from './host/diagnostics.ts'
import { diagnosticErrorCode, diagnosticPayload, noDiagnostics, type DiagnosticSink } from './shared/diagnostics.ts'
import type { NativeTitleBridge } from './shared/native.ts'
import { createRootSettings } from './host/settings.ts'

/** Host half: provides authenticated DSH endpoints for filesystem provisioning. */
export const name = 'dsh-codexlike-projectless'
export const inject = ['connection', 'sessionTitle']

export interface Config {
  /** Absolute parent for date folders; defaults to ~/Documents/DSH. */
  root?: string
  /** Opt-in JSONL diagnostics at ROOT/.dsh-codexlike-projectless.log. */
  debug?: boolean
}

export interface ProjectlessRuntime {
  ownedDirectories: Map<string, string>
  diagnostics: DiagnosticSink
  diagnosticsEnabled: boolean
  nativeTitle?: NativeTitleBridge
  settings?: ReturnType<typeof createRootSettings>
  directoryRoots: Map<string, string>
}

export function createProjectlessRuntime(diagnostics: DiagnosticSink = noDiagnostics, enabled: boolean = false): ProjectlessRuntime {
  return { ownedDirectories: new Map(), directoryRoots: new Map(), diagnostics, diagnosticsEnabled: enabled }
}

type RpcResult =
  | { ok: true, value: unknown }
  | { ok: false, error: { code: string, message: string, details: Record<string, unknown> } }

function pathPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const path = (payload as { path?: unknown }).path
  return typeof path === 'string' ? path : undefined
}

function badRequest(message: string): RpcResult {
  return {
    ok: false,
    error: {
      code: 'bad-request',
      message,
      details: { issues: [] },
    },
  }
}

function internalError(message: string): RpcResult {
  return {
    ok: false,
    error: {
      code: 'internal',
      message,
      details: {},
    },
  }
}

/** Run one decoded endpoint against the configured root. */
export async function dispatchProjectlessEndpoint(
  root: string,
  endpoint: ProjectlessEndpoint,
  payload: unknown,
  runtime: ProjectlessRuntime = createProjectlessRuntime(),
): Promise<RpcResult> {
  try {
    const configuredRoot = root
    root = await runtime.settings?.get() ?? root
    if (endpoint === 'save-root') {
      const candidate = pathPayload(payload)
      if (candidate === undefined) return badRequest('save-root requires { path }')
      if (runtime.settings === undefined) return internalError('Root settings are unavailable')
      return { ok: true, value: { root: await runtime.settings.save(candidate) } }
    }
    if (endpoint === 'prepare-title' || endpoint === 'bind-title') {
      if (runtime.nativeTitle === undefined) return internalError('Install the DSH 0.2.0-rc.2 native projectless bridge before using this build')
      const input = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
      if (typeof input.sessionId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(input.sessionId)) return badRequest('Invalid final Session identity')
      if (endpoint === 'bind-title') {
        if (typeof input.token !== 'string' || input.token.length > 100) return badRequest('Invalid prepared title token')
        runtime.nativeTitle.bindProjectlessTitle(input.sessionId, input.token)
        return { ok: true, value: { bound: true } }
      }
      if (typeof input.text !== 'string' || input.text.length > 1000000) return badRequest('Invalid title input')
      const route = input.route as { provider?: unknown, model?: unknown } | undefined
      if (route === undefined || typeof route.provider !== 'string' || typeof route.model !== 'string') return badRequest('A selected native model is required')
      return { ok: true, value: await runtime.nativeTitle.prepareProjectlessTitle(input.text, {
        provider: route.provider, model: route.model,
      }, input.sessionId, AbortSignal.timeout(60000)) }
    }
    if (endpoint === 'create-directory') {
      const input = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
      if (input.root !== undefined) {
        if (typeof input.root !== 'string' || !(runtime.settings === undefined
          ? input.root === configuredRoot || input.root === await resolveProjectlessRoot(configuredRoot)
          : await runtime.settings.accepts(input.root))) {
          return badRequest('Unknown projectless root')
        }
        root = input.root
      }
      if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 4096)) {
        return badRequest('create-directory title must be a string of at most 4096 characters')
      }
      if (input.untitled !== undefined && (typeof input.untitled !== 'string' || input.untitled.length > 256)) {
        return badRequest('create-directory untitled must be a string of at most 256 characters')
      }
      const path = typeof input.title === 'string'
        ? await createTopicDirectory(root, input.title, input.untitled as string | undefined)
        : await createProjectlessDirectory(root)
      const canonical = await realpath(path)
      runtime.ownedDirectories.set(path, canonical)
      runtime.ownedDirectories.set(canonical, canonical)
      runtime.directoryRoots.set(canonical, root)
      runtime.diagnostics('directory.created', { path })
      return { ok: true, value: { path } }
    }
    if (endpoint === 'get-root') {
      return { ok: true, value: { root: await resolveProjectlessRoot(root), diagnosticsEnabled: runtime.diagnosticsEnabled, nativeReady: runtime.nativeTitle !== undefined } }
    }
    if (endpoint === 'log-event') {
      const record = diagnosticPayload(payload)
      if (record === undefined) return badRequest('log-event requires a supported event and metadata fields')
      runtime.diagnostics(record.event, record.fields)
      return { ok: true, value: { accepted: runtime.diagnosticsEnabled } }
    }
    const path = pathPayload(payload)
    if (path === undefined) return badRequest('remove-directory requires { path }')
    const canonical = await realpath(path).catch(() => path)
    const result = await removeUnusedProjectlessDirectory(runtime.directoryRoots.get(canonical) ?? root, path, runtime.ownedDirectories)
    runtime.diagnostics(result === 'retained' ? 'directory.retained' : 'directory.removed', { path })
    if (result !== 'retained') {
      runtime.ownedDirectories.delete(path)
      runtime.ownedDirectories.delete(canonical)
      runtime.directoryRoots.delete(canonical)
    }
    return { ok: true, value: { result } }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    if (message.includes('absolute path') || message.includes('not a projectless')) {
      return badRequest(message)
    }
    return internalError(message)
  }
}

function envelope(rpcId: string, result: RpcResult): Response {
  return Response.json({ type: 'server-response', rpcId, result })
}

/**
 * Decode Connection's `client-request` envelope for one exact endpoint and
 * answer with its `server-response` envelope, so the browser half keeps using
 * `ctx.connection.rpc.call`.
 */
export function createProjectlessFetch(root: string, endpoint: ProjectlessEndpoint, runtime: ProjectlessRuntime = createProjectlessRuntime()) {
  const method = projectlessEndpoint(endpoint)
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      return new Response('content type must be application/json', { status: 415 })
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response('body is not JSON', { status: 400 })
    }
    const message = body as { type?: unknown, rpcId?: unknown, method?: unknown, payload?: unknown } | null
    if (typeof message !== 'object' || message === null || message.type !== 'client-request' || typeof message.rpcId !== 'string') {
      return new Response('invalid client-request envelope', { status: 400 })
    }
    if (message.method !== method) {
      return envelope(message.rpcId, badRequest(`method ${JSON.stringify(message.method)} does not match endpoint ${JSON.stringify(method)}`))
    }
    const fields = { rpcId: message.rpcId, endpoint }
    if (endpoint !== 'log-event') runtime.diagnostics('rpc.started', fields)
    const result = await dispatchProjectlessEndpoint(root, endpoint, message.payload, runtime)
    if (endpoint !== 'log-event') {
      runtime.diagnostics(result.ok ? 'rpc.finished' : 'rpc.failed', {
        ...fields,
        ...result.ok ? {} : { code: result.error.code },
      })
    }
    return envelope(message.rpcId, result)
  }
}

/** Register the least-privilege endpoints used by the browser half. */
export function apply(ctx: Context, config: Config = {}): void {
  const root = config.root ?? join(homedir(), 'Documents', 'DSH')
  const logger = createDiagnosticLogger(join(root, '.dsh-codexlike-projectless.log'), config.debug === true, error => {
    console.warn(`${name}: diagnostic logging disabled (${diagnosticErrorCode(error)})`)
  })
  const runtime = createProjectlessRuntime(logger.emit, config.debug === true)
  runtime.settings = createRootSettings(root, join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'storages', 'dsh-codexlike-projectless-settings.json'))
  const title = (ctx as unknown as { sessionTitle?: NativeTitleBridge }).sessionTitle
  if (typeof title?.prepareProjectlessTitle === 'function') runtime.nativeTitle = title
  logger.emit('diagnostics.enabled')
  ctx.effect(() => () => logger.flush(), 'dsh-codexlike-projectless: flush diagnostics')
  for (const endpoint of PROJECTLESS_ENDPOINTS) {
    const path = `${PROJECTLESS_RPC_CHANNEL}/${projectlessEndpoint(endpoint)}`
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: createProjectlessFetch(root, endpoint, runtime),
    }), `dsh-codexlike-projectless: ${path}`)
  }
}
