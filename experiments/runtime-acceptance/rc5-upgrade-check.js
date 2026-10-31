async page => {
  if(await page.getByRole('dialog',{name:'设置',exact:true}).count())await page.getByRole('button',{name:'关闭',exact:true}).click()
  const history = await page.evaluate(() => {
    const a=__DSH_ACCEPTANCE__,s=a.snapshot().sessions
    const id=s.ids.find(id=>s.byId[id].projectionValues?.turnOutline?.some(turn=>turn.prompt==='rc3 升级前持久历史'))
    if(!id)throw new Error('Upgrade history missing')
    a.navigation.openSession(id)
    return {id,summary:s.byId[id]}
  })
  await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor()
  await page.getByRole('button',{name:'账号菜单',exact:true}).click()
  await page.getByRole('menuitem',{name:'设置',exact:true}).click()
  const field=page.getByRole('textbox',{name:'工作区根目录',exact:true})
  let root
  if(await field.count()) {
    await field.waitFor({state:'visible'})
    await page.waitForFunction(element=>!element.disabled,await field.elementHandle())
    root=await field.inputValue()
    if(!root.endsWith('runtime-candidate-rc5-upgrade-data\\tasks'))throw new Error('Plugin settings changed during upgrade')
  }
  const settings=await page.locator('body').ariaSnapshot()
  await page.getByRole('button',{name:'关闭',exact:true}).click()
  const bundles=await page.evaluate(async()=>(await __DSH_ACCEPTANCE__.manager.list()).value.filter(item=>item.name==='dsh-codexlike-projectless'))
  return {history,root,settings,bundles}
}
