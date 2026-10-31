async page => {
  const snapshot=()=>page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.map(item=>item.sessionId).sort(),ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.map(item=>item.workspaceId).sort()}))
  const before=await snapshot()
  if(before.host.some(id=>typeof id!=='string'))throw new Error('Invalid host identity observation')
  const removed=await page.evaluate(()=>__DSH_ACCEPTANCE__.manager.remove('dsh-codexlike-projectless'))
  if(!removed.ok||removed.value.application==='failed')throw new Error(JSON.stringify(removed))
  await page.waitForFunction(()=>!__DSH_ACCEPTANCE__.sessions.createProjectlessDraft)
  const after=await snapshot()
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Uninstall modified persistent resources')
  const bundles=await page.evaluate(()=>__DSH_ACCEPTANCE__.manager.list())
  return {before,after,removed,bundles}
}
