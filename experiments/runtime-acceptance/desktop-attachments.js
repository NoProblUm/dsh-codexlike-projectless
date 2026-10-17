async page=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 const baseline=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 await page.locator('input[type=file]').setInputFiles(['experiments/runtime-acceptance/attachment.txt','output/runtime-candidate-rc1-run2/pixel.png']);
 await page.locator('[data-composer-input]').fill('最终 Desktop rc1 文件图片重连验收');
 const before=await page.evaluate(()=>{const p=__DSH_ACCEPTANCE__,s=p.snapshot().sessions;const id=s.ids.find(id=>s.byId[id].retainedBy.mainView>0);const generation=p.connection.generation.getSnapshot().id;p.events.length=0;p.connection.reconnect();return {id,generation}});
 await page.waitForFunction(before=>{const p=__DSH_ACCEPTANCE__;return p.connection.generation.getSnapshot()?.id>before.generation&&p.snapshot().sessions.phase==='ready'},before);
 const retained=await page.evaluate(async before=>{const p=__DSH_ACCEPTANCE__;const input=p.conversation.input.for(p.sessions.binding(before.id).ctx).snapshot;return {host:(await p.hostList()).value.items.length,attachments:input.attachmentIds.length,text:input.draft,missing:p.events.filter(e=>!e.ids.includes(before.id)).length}},before);
 check(retained.host===baseline.host&&retained.attachments===2&&retained.missing===0,'reconnect lost draft/attachments or created session');
 focus(); await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor();
 const after=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));check(after.host===baseline.host+1&&after.ws===baseline.ws,'attachment first send resource mismatch');
 return {passed:true,baseline,retained,after};
}
