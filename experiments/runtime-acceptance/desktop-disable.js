async page=>{
 const before=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.map(x=>x.sessionId),ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 const result=await page.evaluate(()=>__DSH_ACCEPTANCE__.manager.enable('dsh-codexlike-projectless',false));
 await page.waitForFunction(()=>!__DSH_ACCEPTANCE__.sessions.createProjectlessDraft);
 const after=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.map(x=>x.sessionId),ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,wrapped:String(__DSH_ACCEPTANCE__.navigation.startSession).includes('projectless/new-session'),drafts:__DSH_ACCEPTANCE__.snapshot().sessions.ids.filter(x=>x.startsWith('projectless-draft-'))}));
 if(JSON.stringify(before)!==JSON.stringify({host:after.host,ws:after.ws})||after.wrapped||after.drafts.length)throw Error('disable failed ownership/resource preservation');
 return {passed:true,result,after};
}
