async page=>{
 await page.evaluate(()=>__up?.restore());
 const retry=page.getByRole('button',{name:'重试上传 attachment.txt',exact:true});
 if(await retry.count()!==1)throw Error('retry unavailable');await retry.focus();await retry.press('Enter');
 const before=await page.evaluate(async()=>({id:__DSH_ACCEPTANCE__.navigation.mainReference.sessionId,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 await page.locator('[data-composer-input]').press('Enter');await page.waitForFunction(id=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId!==id,before.id,{timeout:20000});
 return {before,after:await page.evaluate(async()=>({id:__DSH_ACCEPTANCE__.navigation.mainReference.sessionId,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}))};
}
