/** Real Host filesystem/RPC + simulated native Session adapter; no model/app is started. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createProjectlessFetch, createProjectlessRuntime } from '../src/index.ts'
import { createDiagnosticLogger } from '../src/host/diagnostics.ts'
import { createAndSendProjectlessSession } from '../src/client/first-prompt.ts'
import { createProjectlessRegistry, type ProjectlessSessionHost } from '../src/client/session.ts'
import type { ProjectlessEndpoint } from '../src/shared/rpc.ts'

const artifacts = resolve('test-artifacts')
await mkdir(artifacts, { recursive: true })
const run = await mkdtemp(join(artifacts, 'trace-'))
const root = join(run, 'workspaces')
const log = join(run, 'trace.log')
const logger = createDiagnosticLogger(log, true, error => { console.error(error) })
const runtime = createProjectlessRuntime(logger.emit, true)
let rpcNumber = 0
async function rpc(endpoint: ProjectlessEndpoint, payload: unknown): Promise<Record<string, unknown>> {
  const method = `dsh-codexlike-projectless/${endpoint}`
  const response = await createProjectlessFetch(root, endpoint, runtime)(new Request(`http://test.local/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: `test-rpc-${++rpcNumber}`, method, payload }),
  }))
  const body = await response.json() as { result: { ok: boolean, value: Record<string, unknown>, error?: { message: string } } }
  assert.equal(body.result.ok, true, body.result.error?.message)
  return body.result.value
}

logger.emit('diagnostics.enabled', { code: 'SIMULATED_NATIVE_ADAPTER' })
const sessionId = 'test-session-1' as SessionId
const workspaceId = 'test-workspace-1' as WorkspaceId
let workspacePath = ''
let registered = false
const host: ProjectlessSessionHost = {
  async create({ path }): Promise<WorkspaceView> {
    workspacePath = path
    registered = true
    return { workspaceId, path, title: '', sessionIds: [], createdAt: '', updatedAt: '' }
  },
  async connectWorkspace() { return sessionId },
  async delete() { registered = false },
  async archiveSession() {},
}
let opened = false
const receipt = await createAndSendProjectlessSession(host, {
  open() { opened = true },
  list: { getSnapshot: () => ({ byId: { [sessionId]: { blank: false } } }), subscribe: () => () => {} },
}, Object.freeze({ text: '仅用于测试日志：创建 SQLite 表', attachmentIds: [] }), {
  // The real rc.2 model and pre-session input integration are intentionally not simulated as working.
  async prepareTitle() { return { title: 'SQLite建表', source: 'test-fixture' } },
  async provisionDirectory(title) { return (await rpc('create-directory', { title, untitled: '未命名' })).path as string },
  async bindPreparedTitle() {},
  async send() {
    await writeFile(join(workspacePath, 'output.txt'), '模拟产物：仅验证工作目录和日志，不代表 Agent 已执行。\n', 'utf8')
    return 'accepted'
  },
  async removeDirectory(path) { await rpc('remove-directory', { path }) },
  isCurrentTarget: () => false,
  onError(error) { throw error },
}, createProjectlessRegistry(), new Set(), logger.emit)

assert.equal(receipt.acceptance, 'accepted')
assert.equal(registered, false)
assert.equal(opened, false, 'background completion must not select the view')
assert.equal((await rpc('remove-directory', { path: workspacePath })).result, 'retained')
const sibling = (await rpc('create-directory', { title: 'SQLite建表', untitled: '未命名' })).path as string
assert.equal(sibling, workspacePath + '_2')
await logger.flush()
const entries = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
assert.ok(entries.some(entry => entry.event === 'workspace.detached'))
assert.ok(entries.some(entry => entry.event === 'directory.retained'))
assert.equal(entries.some(entry => 'text' in entry || 'prompt' in entry || 'attachmentIds' in entry), false)
const report = join(run, '结果.md')
await writeFile(report, [
  '# 第一版日志演示结果', '',
  '- Host 文件系统与认证 RPC envelope：使用实际插件实现。',
  '- 标题生成、Session、消息接收：使用明确标注的模拟适配器；未调用模型或启动 DSH。',
  '- 验证通过：主题目录、重名编号、产物保留、接收后注销、后台完成不抢回视图。',
  `- 日志：${log}`, `- 工作目录：${workspacePath}`, `- 同名目录：${sibling}`, '',
].join('\n'), 'utf8')
console.log(JSON.stringify({ mode: 'simulated-native-adapter', assertions: 'passed', log, report, workspacePath, sibling, events: entries.length }, null, 2))
