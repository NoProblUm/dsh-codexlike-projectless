async page => {
  const status=await page.evaluate(()=>__DSH_ACCEPTANCE__.status())
  if(!status.ok||status.value.state!=='ready'||status.value.version!=='1.3.0'||status.value.build!=='d4db512a969fccf0c5cc7ec8fe38e9c1d27af916')throw new Error('Stable runtime identity mismatch')
  const counts=()=>page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}))
  const before=await counts()
  const close=page.getByRole('button',{name:'切换到无项目',exact:true})
  if(await close.count()) {await page.getByRole('button',{name:'选择工作区',exact:true}).hover();await close.click()}
  else await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession())
  await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'))
  if(JSON.stringify(await counts())!==JSON.stringify(before))throw new Error('Stable draft created host resources')
  await page.evaluate(()=>{const rpc=__DSH_ACCEPTANCE__.connection.rpc[Symbol.for('cordis.original')]??__DSH_ACCEPTANCE__.connection.rpc,original=rpc.call;globalThis.__stable={prompts:[],restore:()=>rpc.call=original};rpc.call=function(...args){if(args[1]==='session/prompt')__stable.prompts.push(args[2]);return original.apply(this,args)}})
  try {
    await page.locator('[data-composer-input]').fill('本地正式版 1.3.0 首发冒烟')
    await page.locator('[data-composer-input]').press('Enter')
    await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor()
    await page.waitForFunction(()=>{const a=__DSH_ACCEPTANCE__;return !a.snapshot().sessions.byId[a.navigation.mainReference.sessionId]?.running})
    const after=await counts(),prompts=await page.evaluate(()=>__stable.prompts)
    if(after.host!==before.host+1||after.ws!==before.ws||prompts.length!==1||typeof prompts[0].args.request.requestId!=='string')throw new Error('Stable first-send resource or request mismatch')
    return {status,before,after,prompts,id:await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.mainReference.sessionId)}
  } finally {await page.evaluate(()=>__stable.restore())}
}
