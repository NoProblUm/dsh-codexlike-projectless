async page=>{
 const results=[];
 for(const stage of ['preparation','submission']) {
  const previous=await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId);
  await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession(undefined,{clearPreviousDraft:true,agentPreset:'standard'}));
  await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'));
  const before=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
  const result=await page.evaluate(async stage=>{
   const a=__DSH_ACCEPTANCE__,raw=o=>o?.[Symbol.for('cordis.original')]??o,id=a.navigation.mainReference.sessionId,session=a.sessions.binding(id).session,rpc=raw(a.connection.rpc),original=rpc.call,abort=new AbortController();let entered,release;const gate=new Promise(r=>entered=r),held=new Promise(r=>release=r);let attempts=0;
   rpc.call=async function(...args){if(args[1]===(stage==='preparation'?'dsh-codexlike-projectless/prepare-title':'session/prompt')){attempts++;entered();await held;if(stage==='submission')return {ok:false,error:{code:'gateway/internal',message:'cancelled unknown request',details:{}}}}return original.apply(this,args)};
   const promise=raw(a.conversation.input).sink(session,'rc2 cancel '+stage,[],'queue',abort.signal);
   await gate;abort.abort(new Error('rc2 test cancellation'));release();
   try{const outcome=await promise;return {outcome,attempts,host:(await a.hostList()).value.items.length,ws:a.snapshot().workspaces.items.length}}
   finally{rpc.call=original}
  },stage);
  if(result.attempts!==1||result.host!==before.host+(stage==='submission'?1:0)||result.ws!==before.ws+(stage==='submission'?1:0))throw Error(JSON.stringify({stage,before,result}));
  results.push({stage,before,result});
 }
 return {passed:true,results};
}
