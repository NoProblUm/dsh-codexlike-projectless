async page=>{
 const counts=()=>page.evaluate(async()=>({host:(await __DSH_ACCEPTANCE__.hostList()).value.items.length,ws:__DSH_ACCEPTANCE__.snapshot().workspaces.items.length,id:__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId}));
 await page.locator('[data-composer-input]').fill('上传失败保留附件');
 await page.waitForFunction(()=>{const a=__DSH_ACCEPTANCE__;return a.conversation.input.shell(a.navigation.mainReference.sessionId).snapshot.attachmentIds.length===1});
 const before=await counts();
 await page.evaluate(()=>{const a=__DSH_ACCEPTANCE__,raw=o=>o?.[Symbol.for('cordis.original')]??o,u=raw(raw(a.conversation).ctx.fileUpload),original=u.upload;globalThis.__up={calls:0,restore:()=>u.upload=original};u.upload=async function(){__up.calls++;return {ok:false,error:{code:'test/upload',message:'fixture upload failed',details:{}}}}});
 await page.locator('[data-composer-input]').press('Enter');
 await page.waitForFunction(()=>__up.calls>0,null,{timeout:20000});
 await page.waitForFunction(()=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference?.sessionId;return id?.startsWith('projectless-draft-')&&a.conversation.input.for(a.sessions.binding(id).ctx).snapshot.phase==='plain'},null,{timeout:20000});
 await page.waitForFunction(({ws,text})=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference?.sessionId;return a.snapshot().workspaces.items.length===ws&&document.querySelector('[data-composer-input]')?.textContent===text&&a.conversation.input.shell(id).snapshot.attachmentIds.length===1},{ws:before.ws,text:'上传失败保留附件'},{timeout:20000});
 const state=await page.evaluate(()=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference.sessionId;return {calls:__up.calls,text:document.querySelector('[data-composer-input]').textContent,attachments:a.conversation.input.shell(id).snapshot.attachmentIds.length}}),after=await counts();await page.evaluate(()=>__up.restore());
 if(after.id!==before.id||after.ws!==before.ws||state.text!=='上传失败保留附件'||state.attachments!==1||state.calls!==1)throw Error(JSON.stringify({before,after,state}));return {before,after,state};
}
