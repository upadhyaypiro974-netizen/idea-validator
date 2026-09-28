import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrief, safeUrl, signEvidence, verifyEvidence, research, checkReport, synthesize } from '../server/research.mjs';
import handler from '../netlify/functions/validate.mjs';
const brief = validateBrief({ idea:'A bilingual missed-call assistant for small dental clinics.', audience:'Small dental clinic owners', geography:'Lucknow, India', alternatives:'Receptionist and WhatsApp', difference:'Hindi and English, ₹3,000/month', evidence:'No customer evidence yet' });
const key = 'test-only-key';
const providerResponse = legacy => {
 const parts = (legacy.output || []).filter(x => x.type === 'message').flatMap(x => x.content);
 const searched = (legacy.output || []).some(x => x.type === 'web_search_call');
 return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: parts.map(p => ({text:p.text})) }, ...(searched ? {groundingMetadata: { webSearchQueries:['competitor pricing'], groundingChunks:parts.flatMap(p => p.annotations || []).map(a => ({web:{uri:a.url,title:a.title}})), searchEntryPoint:{renderedContent:'<div>Google Search</div>'} }} : {}) }] });
};
const source = { id:'S1',title:'Example pricing',url:'https://example.com/pricing' };
const finding = { title:'Product offering',detail:'Example sourced detail',kind:'Evidence',sourceIds:['S1'],date:'Date unknown',limitation:'Vendor claim, not proof of demand' };
const report = () => ({verdict:'Worth testing',summary:'Test the hypothesis',competitors:[{...finding}],customers:[],market:[],gaps:[],risks:[],tests:[{title:'Interview buyers',action:'Ask 5 owners about their last missed call.',measure:'Count owners with a current workaround',pass:'Proposed: 3 describe repeated pain',fail:'Proposed: fewer than 3'}],unknowns:['Willingness to pay']});
test('validates context and bounds',()=>{assert.throws(()=>validateBrief({...brief,idea:'x'})); assert.throws(()=>validateBrief({...brief,evidence:'x'.repeat(1201)}));});
test('rejects unsafe source URLs',()=>{for(const url of ['javascript:alert(1)','http://localhost','http://127.0.0.1','https://u:p@example.com']) assert.equal(safeUrl(url),null); assert.equal(safeUrl(source.url),source.url);});
test('evidence is bound to idea, expiry and signature',()=>{const token=signEvidence({track:'market',sources:[source]},brief,key);assert.equal(verifyEvidence(token,brief,key).track,'market');assert.throws(()=>verifyEvidence(token,{...brief,geography:'USA'},key));assert.throws(()=>verifyEvidence(token+'x',brief,key));const now=Date.now;Date.now=()=>now()+31*60_000;try{assert.throws(()=>verifyEvidence(token,brief,key));}finally{Date.now=now;}});
test('research forces search and extracts only provider citations',async()=>{let body;const data=await research('competitors',brief,key,'gemini-2.5-flash',async(_,req)=>{body=JSON.parse(req.body);return providerResponse({status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Observed offering',annotations:[{type:'url_citation',url:source.url,title:source.title},{type:'url_citation',url:'javascript:alert(1)',title:'bad'}]}]}]});});assert.deepEqual(body.tools,[{google_search:{}}]);assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);assert.equal(data.sources.length,1);});
test('refuses memory-only research',async()=>{await assert.rejects(research('market',brief,key,'gemini-2.5-flash',async()=>providerResponse({status:'completed',output:[]})),/Live search/);});
test('rejects unsupported source IDs and unsourced factual findings',()=>{const r=report();r.competitors[0].sourceIds=['S9'];assert.throws(()=>checkReport(r,[source]),/traced/);r.competitors[0].sourceIds=[];assert.throws(()=>checkReport(r,[source]),/traced/);});
test('low evidence cannot receive a strong verdict',()=>assert.equal(checkReport(report(),[source]).verdict,'Evidence is limited'));
test('synthesis accepts a structurally valid sourced report',async()=>{const r=await synthesize(brief,[{track:'competitors',text:'Evidence',sources:[source]}],key,'gemini-2.5-flash',async()=>providerResponse({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report())}]}]}));assert.equal(r.sources[0].url,source.url);assert.ok(r.generatedAt);});
test('missing key, method and origin fail closed without generating scores',async()=>{const old=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;try{const res=await handler(new Request('https://example.com/api/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));assert.equal(res.status,503);assert.equal((await res.json()).code,'NOT_CONFIGURED');assert.equal((await handler(new Request('https://example.com/api/validate'))).status,405);assert.equal((await handler(new Request('https://example.com/api/validate',{method:'POST',headers:{Origin:'https://evil.example'}}))).status,403);}finally{if(old)process.env.GEMINI_API_KEY=old;}});
test('full endpoint flow research packets -> report; rejects tampering',async()=>{
 const oldKey=process.env.GEMINI_API_KEY,oldFetch=globalThis.fetch; process.env.GEMINI_API_KEY=key;
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  return providerResponse(body.tools ? {status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Example observation',annotations:[{type:'url_citation',url:source.url,title:source.title}]}]}]} : {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report())}]}]});
 };
 const request=data=>handler(new Request('https://example.com/api/validate',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({...data,brief})}));
 try {
  const tokens=[];
  for(const track of ['competitors','customers','market']){const res=await request({action:'research',track});assert.equal(res.status,200);tokens.push((await res.json()).token);}
  const res=await request({action:'report',tokens});assert.equal(res.status,200);assert.equal((await res.json()).sources[0].id,'S1');
  assert.equal((await request({action:'report',tokens:[tokens[0],tokens[0],tokens[0]]})).status,400);
  assert.equal((await request({action:'report',tokens:[tokens[0]+'tamper',tokens[1],tokens[2]]})).status,400);
 }finally{globalThis.fetch=oldFetch;if(oldKey)process.env.GEMINI_API_KEY=oldKey;else delete process.env.GEMINI_API_KEY;}
});
