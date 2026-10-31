async page => {
  const a = await page.evaluate(async () => ({status:await __DSH_ACCEPTANCE__.status(),host:(await __DSH_ACCEPTANCE__.hostList()).value.items,workspaces:__DSH_ACCEPTANCE__.snapshot().workspaces.items}))
  if (!a.status.ok || a.status.value.state !== 'ready') throw new Error('runtime not ready')
  return a
}
