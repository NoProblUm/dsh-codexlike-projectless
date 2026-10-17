async page=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());await new Promise(r=>setTimeout(r,400));
 await page.evaluate(()=>{const rpc=__DSH_ACCEPTANCE__.connection.rpc[Symbol.for('cordis.original')]??__DSH_ACCEPTANCE__.connection.rpc;const original=rpc.call;globalThis.__unknown={calls:0};rpc.call=async function(...args){if(args[1]==='session/prompt'){__unknown.calls++;return {ok:false,error:{code:'gateway/internal',message:'test connection lost',details:{}}}}return original.apply(this,args)}});
 const baseline=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 await page.locator('[data-composer-input]').fill('最终 rc1 未确认请求保留输入');
 focus(); await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.getByText(/发送结果尚未确认/).waitFor();
 const held=await page.evaluate(async()=>({calls:__unknown.calls,host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,text:document.querySelector('[data-composer-input]').textContent}));
 check(held.calls===1&&held.host===baseline.host+1&&held.ws===baseline.ws+1,'uncertain resources lost or duplicate');check(held.text==='最终 rc1 未确认请求保留输入','input lost');check(await page.getByRole('button',{name:'发送消息',exact:true}).isDisabled(),'resend allowed');
 await page.reload();await page.waitForFunction(()=>globalThis.__DSH_ACCEPTANCE__?.snapshot().sessions.phase==='ready');
 const after=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));check(after.host===held.host&&after.ws===held.ws,'reload reclaimed uncertain resources');
 return {passed:true,baseline,held,after};
}
