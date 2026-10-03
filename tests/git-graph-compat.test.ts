import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const { patchGitGraph } = await import(new URL('../native/git-graph-compat.mjs', import.meta.url).href) as {
  patchGitGraph(source: string, version: string): string
}

// The wrapper resolves a fallback before consulting the auto-isolation toggle.
const wrapper = `const routed = (workspaceId) => {
  const target = workspaceId ?? 'project-a';
  if (target === void 0) { original.call(navigation); return; }
  return git.config().then(result => {
    if (!result.ok || !result.value.autoIsolate) { original.call(navigation, target); return; }
    return git.addWorktree(target).then(id => original.call(navigation, id));
  });
}; routed;`

for (const autoIsolate of [false, true]) {
  for (const blank of [false, true]) {
    test(`no-project ${blank ? 'draft' : 'history'} bypasses Git Graph with autoIsolate=${autoIsolate}`, async () => {
      const forwarded: (string | undefined)[] = []
      let configCalls = 0
      let worktreeCalls = 0
      const sessionId = blank ? 'projectless-draft-none' : 'history-none'
      const navigation = {
        mainReference: { sessionId },
        ctx: { bail: (event: string, id: string) => event === 'projectless/is-session' && id === sessionId },
      }
      const original = function (this: unknown, id?: string) {
        assert.equal(this, navigation)
        forwarded.push(id)
      }
      const routed = runInNewContext(patchGitGraph(wrapper, '0.4.4'), {
        navigation, original,
        git: {
          async config() { configCalls++; return { ok: true, value: { autoIsolate } } },
          async addWorktree() { worktreeCalls++; return 'worktree-a' },
        },
      }) as (id?: string) => Promise<void> | undefined
      await routed()
      assert.deepEqual(forwarded, [undefined])
      assert.equal(configCalls, 0)
      assert.equal(worktreeCalls, 0)
      await routed('project-a')
      assert.equal(forwarded.at(-1), autoIsolate ? 'worktree-a' : 'project-a')
      assert.equal(configCalls, 1)
      assert.equal(worktreeCalls, autoIsolate ? 1 : 0)
    })
  }
}

test('normal project inheritance and a missing projectless listener retain the wrapper behavior', async () => {
  for (const result of [false, undefined]) {
    const calls: string[] = []
    const routed = runInNewContext(patchGitGraph(wrapper, '0.4.4'), {
      navigation: { mainReference: { sessionId: 'history-a' }, ctx: { bail: () => result } },
      original: (id: string) => { calls.push(id) },
      git: { config: async () => ({ ok: true, value: { autoIsolate: false } }) },
    }) as () => Promise<void>
    await routed()
    assert.deepEqual(calls, ['project-a'])
  }
})

test('compatibility patch is idempotent and rejects unknown versions or ambiguous anchors', () => {
  const patched = patchGitGraph(wrapper, '0.4.4')
  assert.equal(patchGitGraph(patched, '0.4.4'), patched)
  assert.throws(() => patchGitGraph(wrapper, '0.4.5'), /Unsupported Git Graph version/)
  assert.throws(() => patchGitGraph('', '0.4.4'), /anchor/)
  assert.throws(() => patchGitGraph(wrapper + wrapper, '0.4.4'), /anchor/)
})
