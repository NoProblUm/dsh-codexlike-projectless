async page=>{
 const n=()=>page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId);
 await page.evaluate(()=>__DSH_ACCEPTANCE__.navigation.startSession());
 await page.waitForFunction(()=>__DSH_ACCEPTANCE__.navigation.mainReference?.sessionId.startsWith('projectless-draft-'));
 const id=await n(), input=page.locator('[data-composer-input]'); await input.fill('原内容');
 async function apply(options,expected){await page.evaluate(o=>__DSH_ACCEPTANCE__.navigation.startSession(undefined,o),options);await page.waitForTimeout(150);const text=await input.textContent(),current=await n();if(current!==id||text!==expected)throw new Error(JSON.stringify({options,text,current,id}));return text}
 const keep=await apply({prompt:'忽略',whenDraftExists:'keep',clearPreviousDraft:true},'原内容');
 const append=await apply({prompt:'追加',whenDraftExists:'append'},'原内容追加');
 const replace=await apply({prompt:'替换',whenDraftExists:'replace',clearPreviousDraft:false},'替换');
 const old=await apply({prompt:'旧规则',clearPreviousDraft:true},'旧规则');
 return {id,keep,append,replace,old};
}
