async page => {
  const check = (value, message) => { if (!value) throw new Error(message) }
  const enabled = await page.evaluate(async () => (await __DSH_ACCEPTANCE__.manager.list()).value.find(item=>item.name==='dsh-codexlike-projectless')?.enabled === true)
  const results = []
  for (const mode of ['normal','signature','split','unclosed','empty']) {
    await page.evaluate(enabled => {
      const a = __DSH_ACCEPTANCE__
      a.navigation.startSession(enabled ? undefined : a.snapshot().workspaces.items[0].workspaceId)
    }, enabled)
    await page.waitForFunction(() => !document.body.innerText.includes('隔离测试模型已收到原生提交。'))
    await page.locator('[data-composer-input]').fill('fixture:reasoning:'+mode)
    await page.evaluate(() => {
      globalThis.__reasoningSamples = []
      globalThis.__reasoningTimer = setInterval(() => __reasoningSamples.push(document.body.innerText), 25)
    })
    try {
      await page.locator('[data-composer-input]').press('Enter')
      await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor({timeout:30000})
      await page.waitForFunction(() => {const a=__DSH_ACCEPTANCE__;return !a.snapshot().sessions.byId[a.navigation.mainReference?.sessionId]?.running})
    } finally { await page.evaluate(() => clearInterval(__reasoningTimer)) }
    const samples = await page.evaluate(() => __reasoningSamples)
    check(!samples.some(text=>text.includes('fixture-secret')||text.includes('<signature>')||text.includes('<sig')), 'raw signature exposed during stream: '+mode)
    const row = page.locator('[data-variant="think"]')
    const hidden = mode === 'unclosed' || mode === 'empty'
    check(await row.count() === (hidden ? 0 : 1), 'wrong reasoning visibility: '+mode)
    let expanded
    if (!hidden) {
      if (await row.getAttribute('data-expanded') !== 'true') await row.getByRole('button').first().click()
      expanded = await row.innerText()
      check(expanded.includes(mode==='normal'?'普通思考正文':'可见思考正文') && !expanded.includes('fixture-secret'), 'wrong expanded display: '+mode)
      await row.getByRole('button').first().click()
      await page.waitForFunction(() => !document.querySelector('[data-variant="think"]')?.hasAttribute('data-expanded'))
    }
    const id = await page.evaluate(() => __DSH_ACCEPTANCE__.navigation.mainReference.sessionId)
    await page.reload()
    await page.waitForFunction(() => globalThis.__DSH_ACCEPTANCE__?.snapshot().sessions.phase==='ready')
    await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor()
    const history = await page.locator('body').innerText()
    check(!history.includes('fixture-secret') && !history.includes('<signature>'), 'history exposed raw signature')
    check(await row.count() === (hidden?0:1), 'history reasoning visibility differs')
    results.push({mode,id,enabled,streamSamples:samples.length,signatureNeverVisible:true,hidden,expanded,historyPassed:true})
  }
  return {passed:true,enabled,results}
}
