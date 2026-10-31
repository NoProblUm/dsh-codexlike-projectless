async page=>{
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession(undefined,{clearPreviousDraft:true,agentPreset:'standard'}));
 await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'));
 const before=await page.evaluate(async()=>{const a=__DSH_ACCEPTANCE__,raw=o=>o?.[Symbol.for('cordis.original')]??o,w=raw(a.workspaces),rpc=raw(a.connection.rpc),del=w.delete,call=rpc.call;globalThis.__detach={prompts:0,restore:()=>{w.delete=del;rpc.call=call}};w.delete=async()=>{throw Error('rc2 injected unregister failure')};rpc.call=function(...args){if(args[1]==='session/prompt')__detach.prompts++;return call.apply(this,args)};return {host:(await a.hostList()).value.items.length,ws:a.snapshot().workspaces.items.length}});
 await page.locator('[data-composer-input]').fill('rc2 accepted unregister retry');await page.locator('[data-composer-input]').press('Enter');
 await page.getByRole('button',{name:'重试注销临时工作区',exact:true}).waitFor();
 const held=await page.evaluate(async()=>({prompts:__detach.prompts,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 await page.evaluate(()=>__detach.restore());await page.getByRole('button',{name:'重试注销临时工作区',exact:true}).focus();await page.getByRole('button',{name:'重试注销临时工作区',exact:true}).press('Enter');
 await page.waitForFunction(ws=>__DSH_ACCEPTANCE__.snapshot().workspaces.items.length===ws,before.ws);
 const after=await page.evaluate(async()=>({prompts:__detach.prompts,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 if(held.prompts!==1||held.host!==before.host+1||held.ws!==before.ws+1||after.prompts!==1||after.ws!==before.ws||after.host!==held.host)throw Error(JSON.stringify({before,held,after}));
 return {passed:true,before,held,after};
}
