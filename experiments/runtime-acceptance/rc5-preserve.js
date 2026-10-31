async page => {
  const counts = () => page.evaluate(async () => ({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.map(item=>item.sessionId).sort(),ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.map(item=>item.workspaceId).sort()}))
  const before = await counts()
  const disabled = await page.evaluate(() => __DSH_ACCEPTANCE__.manager.enable('dsh-codexlike-projectless', false))
  if (!disabled.ok) throw new Error('disable failed')
  await page.waitForFunction(() => !__DSH_ACCEPTANCE__.sessions.createProjectlessDraft)
  const after = await counts()
  if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('disable reclaimed uncertain resources')
  const enabled = await page.evaluate(() => __DSH_ACCEPTANCE__.manager.enable('dsh-codexlike-projectless', true))
  if (!enabled.ok) throw new Error('enable failed')
  await page.getByRole('button',{name:'账号菜单',exact:true}).click()
  await page.getByRole('menuitem',{name:'设置',exact:true}).click()
  await page.getByRole('status').filter({hasText:'正常重启'}).waitFor()
  const settings = await page.locator('body').ariaSnapshot()
  await page.getByRole('button',{name:'关闭',exact:true}).click()
  return {before,after,disabled,enabled,settings}
}
