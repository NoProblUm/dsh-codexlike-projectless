import assert from 'node:assert/strict'
import test from 'node:test'
import { assertTargetManifest, assertTargetModule } from '../src/host/runtime.ts'
import { ADAPTER_ID, RUNTIME_PACKAGE_VERSION, TARGET_BUILD, matchesHostRuntime, type RuntimeStatus } from '../src/shared/runtime.ts'

test('only the verified clean rc.5 manifest passes the target gate', () => {
  const manifest = { version: '0.2.1-rc.5', dshBuildCommit: TARGET_BUILD, dshBuildDirty: false }
  assert.doesNotThrow(() => assertTargetManifest(manifest))
  for (const change of [{ version: '0.2.1-rc.3' }, { dshBuildCommit: 'b830ec950faba0a46dda564be3e2d854afed94f1' }, { dshBuildCommit: undefined }, { dshBuildDirty: true }, { dshBuildDirty: undefined }]) {
    assert.throws(() => assertTargetManifest({ ...manifest, ...change }), /宿主构建不在支持范围内/)
  }
})

for (const path of ['dsh-client-file-upload/lib/client.js', 'dsh-api-gateway/lib/client.browser.js', 'dsh-api-session-controller/lib/client.js', 'dsh-api-gateway/lib/index.js', 'dsh-client-ui-conversation/lib/client.js', 'dsh-client-ui-workspace/lib/client.js', 'dsh-session-title/lib/index.js']) {
  test(`missing or modified module is rejected: ${path}`, () => {
    const missing = Object.assign(new Error('missing module'), { code: 'ENOENT' })
    assert.throws(() => assertTargetModule(path, () => { throw missing }), error => error === missing)
    assert.throws(() => assertTargetModule(path, () => Buffer.from('modified module')), /宿主模块不匹配/)
  })
}

test('client only accepts a ready peer with the same adapter, package and build', () => {
  const host: RuntimeStatus = { state: 'ready', reason: '', adapter: ADAPTER_ID, version: RUNTIME_PACKAGE_VERSION, build: TARGET_BUILD, missingCapabilities: [] }
  assert.equal(matchesHostRuntime(host), true)
  const mismatches: Partial<RuntimeStatus>[] = [{ state: 'unsupported' }, { state: 'checking' }, { adapter: 'old adapter' }, { version: '1.2.0' }, { build: 'old build' }, { missingCapabilities: ['missing title'] }]
  for (const mismatch of mismatches) assert.equal(matchesHostRuntime({ ...host, ...mismatch }), false)
})
