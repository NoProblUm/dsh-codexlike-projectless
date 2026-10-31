async page=>{
 const counts=()=>page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,id:__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId}));
 const before=await counts(),text='明确拒绝保留测试';await page.locator('[data-composer-input]').fill(text);
 await page.evaluate(()=>{const raw=o=>o?.[Symbol.for('cordis.original')]??o,rpc=raw(__DSH_ACCEPTANCE__.connection.rpc),original=rpc.call;globalThis.__fault={calls:0,restore:()=>rpc.call=original};rpc.call=async function(...args){if(args[1]==='session/prompt'){__fault.calls++;return {ok:false,error:{code:'session/rejected',message:'fixture rejected',details:{}}}}return original.apply(this,args)}});
 await page.locator('[data-composer-input]').press('Enter');await page.waitForFunction(()=>__fault.calls>0,null,{timeout:20000});
 await page.waitForFunction(()=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference?.sessionId;return id?.startsWith('projectless-draft-')&&a.conversation.input.for(a.sessions.binding(id).ctx).snapshot.phase==='plain'},null,{timeout:20000});
 await page.waitForFunction(({ws,text})=>__DSH_ACCEPTANCE__.snapshot().workspaces.items.length===ws&&document.querySelector('[data-composer-input]')?.textContent===text,{ws:before.ws,text},{timeout:20000});
 const after=await counts(),state=await page.evaluate(()=>({calls:__fault.calls,text:document.querySelector('[data-composer-input]').textContent}));await page.evaluate(()=>__fault.restore());
 if(after.id!==before.id||after.ws!==before.ws||state.text!==text||state.calls!==1)throw Error(JSON.stringify({before,after,state}));return {before,after,state};
}
