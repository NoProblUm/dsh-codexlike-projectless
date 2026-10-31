async page => {
  const check = (value, message) => { if (!value) throw new Error(message) }
  const status = await page.evaluate(() => __DSH_ACCEPTANCE__.status())
  check(status.ok && status.value.state === 'ready' && status.value.version === '1.3.0-rc.1' && status.value.build === 'd4db512a969fccf0c5cc7ec8fe38e9c1d27af916', 'incorrect runtime identity')
  const close = page.getByRole('button', {name:'切换到无项目',exact:true})
  if (await close.count()) {
    await page.getByRole('button', {name:'选择工作区',exact:true}).hover()
    await close.click()
  } else await page.evaluate(() => __DSH_ACCEPTANCE__.navigation.startSession())
  await page.waitForFunction(() => __DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'))
  const before = await page.evaluate(async () => ({ id: __DSH_ACCEPTANCE__.navigation.mainReference.sessionId, host: (await __DSH_ACCEPTANCE__.hostList()).value.items.length, ws: __DSH_ACCEPTANCE__.snapshot().workspaces.items.length }))
  const input = page.locator('[data-composer-input]')
  await input.fill('原内容')
  const policies = []
  for (const [options, expected] of [[{prompt:'忽略',whenDraftExists:'keep',clearPreviousDraft:true},'原内容'],[{prompt:'追加',whenDraftExists:'append'},'原内容追加'],[{prompt:'替换',whenDraftExists:'replace',clearPreviousDraft:false},'替换'],[{prompt:'旧规则',clearPreviousDraft:true},'旧规则']]) {
    await page.evaluate(options => __DSH_ACCEPTANCE__.navigation.startSession(undefined, options), options)
    await page.waitForFunction(expected => document.querySelector('[data-composer-input]')?.textContent === expected, expected)
    check(await page.evaluate(() => __DSH_ACCEPTANCE__.navigation.mainReference.sessionId) === before.id, 'initialization replaced draft identity')
    policies.push({options, text:await input.textContent()})
  }
  const group = page.locator('[data-row-key="workspace:"]')
  await group.hover()
  await group.getByRole('button').click()
  check(await input.textContent() === '旧规则', 'sidebar entry lost draft')
  const draftResources = await page.evaluate(async () => ({ host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length, ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length }))
  check(draftResources.host === before.host && draftResources.ws === before.ws, 'draft created host resources')
  if (await page.getByRole('button', {name:'请选择模型',exact:true}).count()) {
    await page.getByRole('button', {name:'请选择模型',exact:true}).click()
    await page.getByRole('option', {name:/Fixture/}).click()
  }
  await input.fill('rc5 核心首发验证')
  await input.press('Enter')
  await page.getByText('隔离测试模型已收到原生提交。', {exact:true}).waitFor({timeout:30000})
  const after = await page.evaluate(async () => ({id:__DSH_ACCEPTANCE__.navigation.mainReference.sessionId,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,body:document.body.innerText}))
  check(after.host === before.host + 1 && after.ws === before.ws, 'first send leaked workspace or duplicated session')
  return {status,before,policies,draftResources,after}
}
