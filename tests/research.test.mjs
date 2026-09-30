import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrief, safeUrl, signEvidence, verifyEvidence, planResearch, callAI, research, checkReport, assessStrength, synthesize } from '../server/research.mjs';
import handler from '../netlify/functions/validate.mjs';
const brief = validateBrief({ idea:'A bilingual missed-call assistant for small dental clinics.', audience:'Small dental clinic owners', geography:'Lucknow, India', alternatives:'Receptionist and WhatsApp', difference:'Hindi and English, ₹3,000/month', evidence:'No customer evidence yet' });
const key = 'test-only-key';
const providerResponse = value => Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
const source = { id:'S1',title:'Example pricing',url:'https://example.com/pricing' };
const finding = { title:'Product offering',detail:'Example sourced detail',kind:'Evidence',sourceIds:['S1'],date:'Date unknown',limitation:'Vendor claim, not proof of demand' };
const report = () => ({assessment:Object.fromEntries(['demand','differentiation','payment'].map(k=>[k,{status:'unknown',reason:'Not established',sourceIds:[]}])),verdict:'Worth testing',summary:'Test the hypothesis',competitors:[{...finding}],customers:[],market:[],gaps:[],risks:[],tests:[{title:'Interview buyers',action:'Ask 5 owners about their last missed call.',measure:'Count owners with a current workaround',pass:'Proposed: 3 describe repeated pain',fail:'Proposed: fewer than 3'}],unknowns:['Willingness to pay']});
test('validates context and bounds',()=>{assert.throws(()=>validateBrief({...brief,idea:'x'})); assert.throws(()=>validateBrief({...brief,evidence:'x'.repeat(1201)}));});
test('rejects unsafe source URLs',()=>{for(const url of ['javascript:alert(1)','http://localhost','http://127.0.0.1','https://u:p@example.com']) assert.equal(safeUrl(url),null); assert.equal(safeUrl(source.url),source.url);});
test('evidence is bound to idea, expiry and signature',()=>{const token=signEvidence({track:'market',sources:[source]},brief,key);assert.equal(verifyEvidence(token,brief,key).track,'market');assert.throws(()=>verifyEvidence(token,{...brief,geography:'USA'},key));assert.throws(()=>verifyEvidence(token+'x',brief,key));const now=Date.now;Date.now=()=>now()+31*60_000;try{assert.throws(()=>verifyEvidence(token,brief,key));}finally{Date.now=now;}});
test('rejects unsupported source IDs and unsourced factual findings',()=>{const r=report();r.competitors[0].sourceIds=['S9'];assert.throws(()=>checkReport(r,[source]),/traced/);r.competitors[0].sourceIds=[];assert.throws(()=>checkReport(r,[source]),/traced/);});
test('low evidence cannot receive a strong verdict',()=>assert.equal(checkReport(report(),[source]).verdict,'Evidence is limited'));
test('full endpoint plans, searches, synthesizes and rejects forged packets',async()=>{
 const oldFetch=globalThis.fetch, oldGroq=process.env.GROQ_API_KEY, oldTavily=process.env.TAVILY_API_KEY;
 process.env.GROQ_API_KEY=key;process.env.TAVILY_API_KEY='search-test-key';
 const queries={competitors:'dental clinic assistant pricing India',customers:'dental clinic assistant customer reviews',market:'India dental clinics missed calls demand'};
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if(url.includes('tavily')) {assert.equal(options.headers.Authorization,'Bearer search-test-key');assert.equal(body.search_depth,'advanced');return Response.json({results:[{...source,content:'Vendor describes bilingual reminders.'},{url:'javascript:alert(1)',content:'bad'}]});}
  assert.equal(options.headers.Authorization,`Bearer ${key}`);assert.equal(body.response_format.json_schema.strict,true);
  return providerResponse(body.max_completion_tokens===650?queries:report());
 };
 const request=data=>handler(new Request('https://example.com/api/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,brief})}));
 try{
  const plan=await request({action:'plan'});assert.equal(plan.status,200);const planToken=(await plan.json()).token;
  const tokens=[];
  for(const track of ['competitors','customers','market']){const res=await request({action:'research',track,planToken});assert.equal(res.status,200);const data=await res.json();assert.equal(data.sourceCount,1);tokens.push(data.token);}
  const res=await request({action:'report',tokens});assert.equal(res.status,200);assert.equal((await res.json()).sources[0].url,source.url);
  assert.equal(calls.length,5);
  assert.equal((await request({action:'research',track:'market',planToken:planToken+'bad'})).status,400);
  assert.equal((await request({action:'report',tokens:[tokens[0],tokens[0],tokens[0]]})).status,400);
  assert.equal((await request({action:'report',tokens:[planToken,tokens[1],tokens[2]]})).status,400);
  delete process.env.TAVILY_API_KEY;assert.equal((await request({action:'plan'})).status,503);
  assert.equal((await handler(new Request('https://example.com/api/validate'))).status,405);
 }finally{globalThis.fetch=oldFetch;for(const [name,value] of [['GROQ_API_KEY',oldGroq],['TAVILY_API_KEY',oldTavily]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
test('provider failure never exposes raw secrets',async()=>{
 for(const status of [401,403,429,432,500])await assert.rejects(research('market',brief,key,'test query',async()=>Response.json({error:'secret-value'},{status})),e=>!e.message.includes('secret-value')&&e.message.includes('TAVILY_'));
});
test('empty searches remain empty instead of inventing evidence',async()=>{
 const e=await research('market',brief,key,'test query',async()=>Response.json({results:[]}));assert.equal(e.sources.length,0);
 await assert.rejects(synthesize(brief,[e],key,'openai/gpt-oss-20b'),/No traceable/);
});

const ratingSources = [source,{id:'S2',url:'https://buyers.example.org/review',title:'Buyer review'}];
const ratings = statuses => Object.fromEntries(['demand','differentiation','payment'].map((k,i)=>[k,{status:statuses[i],reason:'Relevant evidence with limitations',sourceIds:statuses[i]==='unknown'?[]:[i===1?'S2':'S1']}]));
test('strength rubric distinguishes strong, medium, weak and unclear',()=>{
 for(const [statuses,verdict] of [
  [['supported','supported','supported'],'Worth testing'],
  [['supported','mixed','unknown'],'Differentiate first'],
  [['supported','adverse','unknown'],'Differentiate first'],
  [['supported','adverse','adverse'],'Reconsider the approach'],
  [['adverse','mixed','unknown'],'Reconsider the approach'],
  [['unknown','supported','unknown'],'Evidence is limited'],
  [['unknown','unknown','unknown'],'Evidence is limited']
 ]) assert.equal(assessStrength(ratings(statuses),ratingSources).verdict,verdict);
});
test('uncited ratings cannot produce strong or weak judgments',()=>{
 const a=ratings(['adverse','adverse','adverse']);for(const x of Object.values(a))x.sourceIds=[];
 assert.equal(assessStrength(a,ratingSources).verdict,'Evidence is limited');
 a.demand.sourceIds=['fake'];assert.throws(()=>assessStrength(a,ratingSources),/incomplete/);
});
test('multiple pages from one domain cannot produce Strong',()=>{
 assert.equal(assessStrength(ratings(['supported','supported','supported']),[source,{id:'S2',url:'https://example.com/reviews'}]).verdict,'Differentiate first');
});
test('server corrects model verdict and preserves assessment citations',()=>{
 const r=report();r.assessment=ratings(['supported','mixed','unknown']);
 const checked=checkReport(r,ratingSources);
 assert.equal(checked.verdict,'Differentiate first');assert.equal(checked.sources.length,2);
});
