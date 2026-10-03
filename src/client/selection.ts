export const SELECTION_KEY = 'dsh-projectless-session.selected-workspace'
export type Selection = { kind: 'unset' } | { kind: 'projectless' } | { kind: 'project', workspaceId: string }

/** Accept the old empty/string values without conflating absent and projectless. */
export function decodeSelection(value: string | null): Selection {
  if (value === null) return { kind: 'unset' }
  if (value === '') return { kind: 'projectless' }
  try {
    const saved = JSON.parse(value) as Selection
    if (saved.kind === 'projectless') return saved
    if (saved.kind === 'project' && typeof saved.workspaceId === 'string') return saved
  } catch { /* Legacy workspace identity. */ }
  return { kind: 'project', workspaceId: value }
}

/** One recently used blank editor per project; explicit new keeps older editors alive. */
export function createDraftCache<Id>() {
  const latest = new Map<string, Id>()
  return {
    remember(key: string, id: Id) { latest.set(key, id) },
    find(key: string) { return latest.get(key) },
    remove(id: Id) { for (const [key, value] of latest) if (value === id) latest.delete(key) },
  }
}
