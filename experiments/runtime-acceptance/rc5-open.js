async page => {
  if (await page.getByRole('dialog',{name:'设置',exact:true}).count()) await page.getByRole('button',{name:'关闭',exact:true}).click()
  await page.keyboard.press('Escape')
  const close = page.getByRole('button',{name:'切换到无项目',exact:true})
  if (await close.count()) {
    await page.getByRole('button',{name:'选择工作区',exact:true}).hover()
    await close.click()
  } else await page.evaluate(() => __DSH_ACCEPTANCE__.navigation.startSession())
  await page.waitForFunction(() => __DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'))
  return page.evaluate(async () => ({ id:__DSH_ACCEPTANCE__.navigation.mainReference.sessionId,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length }))
}
