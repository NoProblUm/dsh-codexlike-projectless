async page=>{
 await page.waitForTimeout(1200);await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'));
 const input=page.locator('[data-composer-input]');await input.fill('入口复用测试');const before=await page.evaluate(async()=>({id:__DSH_ACCEPTANCE__.navigation.mainReference.sessionId,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 const group=page.locator('[data-row-key="workspace:"]');await group.hover();const bubble=group.getByRole('button');await bubble.focus();await bubble.press('Enter');await bubble.press('Space');await page.waitForTimeout(300);
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());await page.waitForTimeout(300);
 const after=await page.evaluate(async()=>({id:__DSH_ACCEPTANCE__.navigation.mainReference.sessionId,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,drafts:__DSH_ACCEPTANCE__.snapshot().sessions.ids.filter(x=>x.startsWith('projectless-draft-'))}));const text=await input.textContent();
 if(before.id!==after.id||before.host!==after.host||before.ws!==after.ws||after.drafts.length!==1||text!=='入口复用测试')throw Error(JSON.stringify({before,after,text}));return {before,after,text};
}
