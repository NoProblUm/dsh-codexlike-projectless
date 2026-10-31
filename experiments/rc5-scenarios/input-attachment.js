async page=>{
 const a=()=>page.evaluate(()=>{const a=__DSH_ACCEPTANCE__,id=a.navigation.mainReference.sessionId,s=a.conversation.input.shell(id).snapshot;return {id,attachmentIds:[...s.attachmentIds],text:document.querySelector('[data-composer-input]')?.textContent}});
 const input=page.locator('[data-composer-input]');await input.fill('');await page.locator('input[type=file]').setInputFiles('experiments/runtime-acceptance/attachment.txt');
 await page.waitForFunction(()=>{const a=__DSH_ACCEPTANCE__;return a.conversation.input.shell(a.navigation.mainReference.sessionId).snapshot.attachmentIds.length===1});
 const before=await a();await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession(undefined,{prompt:'ignored',whenDraftExists:'keep'}));await page.waitForTimeout(150);const keep=await a();
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession(undefined,{prompt:'replacement',whenDraftExists:'replace'}));await page.waitForTimeout(150);const replace=await a();
 if(before.id!==keep.id||keep.id!==replace.id||keep.text!==''||replace.text!=='replacement'||JSON.stringify(before.attachmentIds)!==JSON.stringify(replace.attachmentIds))throw Error(JSON.stringify({before,keep,replace}));
 return {before,keep,replace};
}
