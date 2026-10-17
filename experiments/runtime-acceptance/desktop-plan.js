async page => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 const baseline=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 if(!await page.getByRole('button',{name:'计划模式已开启，按下关闭',exact:true}).count()) { await page.getByRole('button',{name:'添加文件或调用指令',exact:true}).click();
 await page.getByRole('option',{name:'plan 切换规划模式',exact:true}).click(); }
 await page.getByRole('button',{name:'计划模式已开启，按下关闭',exact:true}).waitFor();
 const current=await page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length}));
 check(JSON.stringify(baseline)===JSON.stringify(current),'local control created resources');
 await page.locator('[data-composer-input]').fill('最终 rc1 原生规划首发');
 focus(); await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.getByText('隔离测试模型已收到原生提交。',{exact:true}).waitFor();
 const final=await page.evaluate(async()=>{const p=__DSH_ACCEPTANCE__,s=p.snapshot();const id=s.sessions.ids.find(id=>s.sessions.byId[id].retainedBy.mainView>0);return {id,plan:s.sessions.byId[id].projectionValues.plan,host:(await p.hostList()).value.items.length,ws:s.workspaces.items.length,status:await p.status()}});
 check(final.plan.active,'native plan lost');check(final.host===baseline.host+1,'wrong session count');check(final.ws===baseline.ws,'workspace leaked');
 return {passed:true,baseline,final};
}
