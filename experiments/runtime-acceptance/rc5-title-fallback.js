async page => {
  await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession())
  await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'))
  await page.locator('[data-composer-input]').fill('fixture:title-fail 原生标题回退验证')
  await page.locator('[data-composer-input]').press('Enter')
  await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor()
  const result=await page.evaluate(()=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference.sessionId;return {id,summary:a.snapshot().sessions.byId[id]}})
  if(!result.summary.displayTitle||result.summary.displayTitle==='运行时首发验证'||!result.summary.cwd)throw new Error('Native title fallback not used')
  return result
}
