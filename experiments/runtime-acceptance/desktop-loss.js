async page=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.evaluate(()=>{if(globalThis.__gate) __gate.restore();const rpc=__DSH_ACCEPTANCE__.connection.rpc[Symbol.for('cordis.original')]??__DSH_ACCEPTANCE__.connection.rpc;const original=rpc.call;globalThis.__loss={calls:0,restore:()=>rpc.call=original};rpc.call=async function(...args){const result=await original.apply(this,args);if(args[1]==='session/prompt'){__loss.calls++;__loss.payload=args[2];__loss.nativeAccepted=result.ok;return {ok:false,error:{code:'gateway/internal',message:'Acceptance test: dropped acknowledgement',details:{}}}}return result}});
 const baseline=await page.evaluate(async()=>(await __DSH_ACCEPTANCE__.hostList()).value.items.length);
 await page.locator('[data-composer-input]').fill('最终 rc1 宿主已接收但响应丢失');
 focus(); await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.waitForFunction(()=>{const s=__DSH_ACCEPTANCE__.snapshot().sessions;return s.ids.some(id=>!id.startsWith('projectless-draft-')&&s.byId[id].retainedBy.mainView>0)});
 await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor();
 const result=await page.evaluate(async()=>{const p=__DSH_ACCEPTANCE__,s=p.snapshot();const id=s.sessions.ids.find(id=>s.sessions.byId[id].retainedBy.mainView>0);return {id,calls:__loss.calls,nativeAccepted:__loss.nativeAccepted,payload:__loss.payload,host:(await p.hostList()).value.items.length,ws:s.workspaces.items.length}});
 check(result.calls===1&&result.nativeAccepted,'request was not accepted exactly once');check(result.host===baseline+1,'duplicate session');check(result.ws===1,'workspace was not detached after durable observation');
 await page.evaluate(()=>__loss.restore());return {passed:true,baseline,result};
}
