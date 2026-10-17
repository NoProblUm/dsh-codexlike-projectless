import assert from 'node:assert/strict'
import test from 'node:test'
import type { ModelCatalog } from '@deepseek-ai/dsh-api-session-controller'
import { requireCatalogSelection } from '../src/client/model.ts'

const selection = { provider: 'host-provider', model: 'host-route', reasoningEffort: 'host-effort' }
const catalog: ModelCatalog = {
  default: selection, routableProviders: ['host-provider'], failures: [],
  groups: [{ id: 'host-provider', name: 'Host', models: [{ id: 'host-route', name: 'Host model', reasoning: { efforts: [{ id: 'host-effort', name: 'Host effort' }] } }] }],
}
test('catalog accepts exact host route and effort without display-name assumptions', () => {
  requireCatalogSelection(catalog, selection)
  assert.deepEqual(selection, catalog.default)
})
test('unavailable catalog, route or effort blocks the frozen selection without fallback', () => {
  for (const value of [{ ...catalog, groups: [] }, { ...catalog, routableProviders: [] }]) assert.throws(() => requireCatalogSelection(value, selection), /目录不可用/)
  assert.throws(() => requireCatalogSelection(catalog, { ...selection, model: 'other' }), /目录不可用/)
  assert.throws(() => requireCatalogSelection(catalog, { ...selection, reasoningEffort: 'other' }), /推理强度/)
  assert.equal(selection.model, 'host-route')
})
