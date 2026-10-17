async page => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 const current=()=>page.evaluate(()=>{const s=__DSH_ACCEPTANCE__.snapshot().sessions;return s.ids.find(id=>s.byId[id].retainedBy.mainView>0)});
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());await new Promise(r=>setTimeout(r,500));
 const first=await current();
 await page.evaluate(()=>{const rpc=__DSH_ACCEPTANCE__.connection.rpc[Symbol.for('cordis.original')]??__DSH_ACCEPTANCE__.connection.rpc;const original=rpc.call;let release;const gate=new Promise(r=>release=r);globalThis.__gate={hit:false,release,restore:()=>rpc.call=original};rpc.call=async function(...args){const result=await original.apply(this,args);if(String(args[1]).includes('prepare-title')){__gate.hit=true;await gate}return result}});
 await page.locator('[data-composer-input]').fill('通信边界标题准备中切换视图验收');
 focus(); await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await page.waitForFunction(()=>globalThis.__gate.hit);
 const count=await page.evaluate(async()=>(await __DSH_ACCEPTANCE__.hostList()).value.items.length);
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());await new Promise(r=>setTimeout(r,500));
 const second=await current();check(second!==first,'navigation did not switch');
 await page.evaluate(()=>__gate.release());
 await page.waitForFunction(async baseline=>(await __DSH_ACCEPTANCE__.hostList()).value.items.length===baseline+1,count);
 await new Promise(r=>setTimeout(r,700));check(await current()===second,'background send stole navigation');
 await page.evaluate(()=>__gate.restore());return {passed:true,first,second,current:await current()};
}
