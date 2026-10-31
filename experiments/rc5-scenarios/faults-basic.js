async page=>{
 const counts=()=>page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,id:__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId}));
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());
 await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'));
 const results=[];
 for (const endpoint of ['session/modelCatalog','dsh-codexlike-projectless/create-directory']) {
  const before=await counts();const text='fault '+endpoint;await page.locator('[data-composer-input]').fill(text);
  await page.evaluate(endpoint=>{const raw=o=>o?.[Symbol.for('cordis.original')]??o,rpc=raw(__DSH_ACCEPTANCE__.connection.rpc),original=rpc.call;globalThis.__fault={calls:0,restore:()=>rpc.call=original};rpc.call=async function(...args){if(args[1]===endpoint){__fault.calls++;return {ok:false,error:{code:'test/failure',message:'fixture injected failure',details:{}}}}return original.apply(this,args)}},endpoint);
  await page.locator('[data-composer-input]').press('Enter');await page.waitForFunction(()=>__fault.calls>0,null,{timeout:15000});
  await page.waitForFunction(()=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference?.sessionId;return id?.startsWith('projectless-draft-')&&a.conversation.input.for(a.sessions.binding(id).ctx).snapshot.phase==='plain'},null,{timeout:15000});
  const after=await counts(), state=await page.evaluate(()=>({calls:__fault.calls,text:document.querySelector('[data-composer-input]').textContent}));await page.evaluate(()=>__fault.restore());
  if(before.host!==after.host||before.ws!==after.ws||before.id!==after.id||state.text!==text||state.calls!==1)throw Error(JSON.stringify({endpoint,before,after,state}));
  results.push({endpoint,before,after,state});
 }
 return results;
}
