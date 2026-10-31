async page => {
  const result=await page.evaluate(()=>__DSH_ACCEPTANCE__.manager.install('file:E:/MyFork/jarvislukdsh-projectless-session/dsh-rc5-1.3.0/output/dsh-codexlike-projectless-1.3.0-rc.1.tgz'))
  const bundles=await page.evaluate(async()=>(await __DSH_ACCEPTANCE__.manager.list()).value.filter(item=>item.name==='dsh-codexlike-projectless'))
  if(!JSON.stringify({result,bundles}).includes('incompatible-version'))throw new Error('Old host did not reject the candidate for incompatibility: '+JSON.stringify({result,bundles}))
  await page.evaluate(()=>{const a=__DSH_ACCEPTANCE__;a.navigation.startSession(a.snapshot().workspaces.items[0].workspaceId,{prompt:'旧宿主拒绝后原生项目可用',whenDraftExists:'replace'})})
  await page.waitForFunction(()=>document.querySelector('[data-composer-input]')?.textContent==='旧宿主拒绝后原生项目可用')
  return {result,bundles,nativeProjectUsable:true}
}
