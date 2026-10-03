import assert from 'node:assert/strict'
import test from 'node:test'
import { createDraftCache, decodeSelection } from '../src/client/selection.ts'

test('selection distinguishes missing and no project, and reads legacy values', () => {
  assert.deepEqual(decodeSelection(null), { kind: 'unset' })
  assert.deepEqual(decodeSelection(''), { kind: 'projectless' })
  assert.deepEqual(decodeSelection('project-a'), { kind: 'project', workspaceId: 'project-a' })
  for (const choice of [{ kind: 'projectless' }, { kind: 'project', workspaceId: 'a' }]) {
    assert.deepEqual(decodeSelection(JSON.stringify(choice)), choice)
  }
})

test('switching restores independent recent drafts and admission clears only its own editor', () => {
  const cache = createDraftCache<string>()
  cache.remember('none', 'draft-none')
  cache.remember('a', 'draft-a')
  cache.remember('b', 'draft-b')
  assert.equal(cache.find('none'), 'draft-none')
  assert.equal(cache.find('a'), 'draft-a')
  cache.remember('none', 'new-none')
  cache.remove('draft-none')
  assert.equal(cache.find('none'), 'new-none')
  cache.remove('new-none')
  assert.equal(cache.find('none'), undefined)
  assert.equal(cache.find('a'), 'draft-a')
  assert.equal(cache.find('b'), 'draft-b')
})
