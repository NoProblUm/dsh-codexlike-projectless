async page => {
  await page.evaluate(()=>{const a=__DSH_ACCEPTANCE__,s=a.snapshot().sessions,id=s.ids.find(id=>!id.startsWith('projectless-draft-')&&!s.byId[id].blank);a.navigation.openSession(id)})
  const short=page.getByRole('tab',{name:'对话',exact:true})
  await short.hover()
  await page.waitForTimeout(500)
  if(await page.getByRole('tooltip').filter({hasText:/^对话$/}).count())throw new Error('Short tab unexpectedly shows tooltip')
  const more=page.getByRole('button',{name:'更多会话视图',exact:true})
  await more.hover()
  await page.getByRole('tooltip').filter({hasText:/^更多会话视图$/}).waitFor()
  await more.focus()
  await more.press('Enter')
  const menu=await page.getByRole('menu').ariaSnapshot()
  await page.keyboard.press('Escape')
  return {shortTooltipAbsent:true,moreTooltip:'更多会话视图',keyboardMenu:menu}
}
