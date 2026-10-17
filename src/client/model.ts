import type { ModelCatalog, ModelSelection } from '@deepseek-ai/dsh-api-session-controller'

/** A frozen selection must remain an exact route in the current host catalog. */
export function requireCatalogSelection(catalog: ModelCatalog, selection: ModelSelection): void {
  const model = catalog.groups.find(group => group.id === selection.provider)?.models.find(model => model.id === selection.model)
  if (!catalog.routableProviders.includes(selection.provider) || model === undefined) throw new Error('所选模型目录不可用，请恢复连接或重新选择模型。')
  if (selection.reasoningEffort !== undefined && !model.reasoning?.efforts.some(effort => effort.id === selection.reasoningEffort)) throw new Error('所选模型不支持当前推理强度，请重新选择。')
}
