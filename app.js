const $ = selector => document.querySelector(selector);
const form = $('#quiz-form');
const results = $('#results');
const nextButton = $('#next-button');
const backButton = $('#back-button');
const restartButton = $('#restart-button');
const fields = ['idea','audience','geography','alternatives','difference','evidence'];
const minimums = [20,5,2,2,2,2];
const aside = [
  ['What are you solving?', 'Describe the problem, what your product does, and when someone would use it.'],
  ['Start with one buyer.', 'Name the people who would use it and who would actually pay.'],
  ['Choose a real market.', 'Competitors, pricing and customer needs differ by country and city.'],
  ['Look at today’s workaround.', 'Include competitors, spreadsheets, agencies, or doing nothing. “Not sure” is fine.'],
  ['Give users a reason to switch.', 'What would improve enough for someone to leave their current solution?'],
  ['Separate proof from belief.', 'Summarize interviews, signups or payments. “No evidence yet” is a useful answer.']
];
let step = 1;
let busy = false;
let controller;
let savedResearch = null;
let lastReport;
const status = $('#research-status');
function updateStep(value) {
  step = value;
  document.querySelectorAll('.question').forEach((node, i) => node.classList.toggle('active', i + 1 === step));
  document.querySelectorAll('.steps span').forEach((node, i) => node.classList.toggle('active', i < step));
  $('#step-label').textContent = `QUESTION ${step} OF 6`;
  $('#aside-title').textContent = aside[step - 1][0];
  $('#aside-copy').textContent = aside[step - 1][1];
  backButton.classList.toggle('hidden', step === 1);
  nextButton.textContent = step === 6 ? 'Research my idea →' : 'Continue →';
}
function valid() {
  const name = fields[step - 1], input = $('#' + name);
  if (input.value.trim().length < minimums[step - 1]) {
    $('#' + name + '-error').textContent = 'Add a little more detail to focus the research.';
    input.focus(); return false;
  }
  return true;
}
const brief = () => Object.fromEntries(fields.map(name => [name, $('#' + name).value.trim()]));
async function request(payload) {
  const res = await fetch('/api/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal });
  let data;
  try { data = await res.json(); } catch { throw new Error(res.status === 429 ? 'Too many checks. Please wait three minutes and try again.' : 'The research service is not available yet. Your answers are kept.'); }
  if (!res.ok) throw new Error(data.error || 'Research could not finish. Please retry.');
  return data;
}
function setBusy(value) {
  busy = value;
  form.setAttribute('aria-busy', String(value));
  form.querySelectorAll('input, textarea, button').forEach(el => el.disabled = value);
  nextButton.textContent = value ? 'Researching…' : 'Research my idea →';
}
function element(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
const reportSections = [
  ['competitors','Competitors & alternatives','01','Who already solves this problem?'],
  ['customers','Customer evidence','02','What people actually say and do.'],
  ['market','Market signals','03','Demand, timing and adoption barriers.'],
  ['gaps','Possible gaps to test','04','Hypotheses to investigate, not proven openings.'],
  ['risks','Risks & contrary evidence','05','What could challenge your idea.'],
  ['tests','Your seven-day validation tests','06','Small actions before a big commitment.'],
  ['unknowns','What is still unknown','07','The missing pieces in this research.']
];
function findingCard(item, sources) {
  const card = element('article', undefined, 'finding-card');
  const meta = element('div',undefined,'finding-meta');
  meta.append(element('span',item.kind,'finding-badge '+item.kind.toLowerCase()),element('span',item.date || 'Date unknown','finding-date'));
  card.append(meta,element('h4', item.title), element('p', item.detail));
  if (item.limitation) { const note=element('p',undefined,'finding-limit');note.append(element('strong','Context: '),document.createTextNode(item.limitation));card.append(note); }
  const refs = element('div',undefined,'source-links');
  for (const id of item.sourceIds) {
    const source = sources.find(s => s.id === id);
    if (!source) continue;
    const link = element('a', `${id} · ${new URL(source.url).hostname.replace(/^www\./,'')} ↗`);
    link.title=source.title;link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';refs.append(link);
  }
  if (refs.children.length) card.append(refs);
  return card;
}
function render(report) {
  lastReport = report;
  const covered=['competitors','customers','market'].filter(key=>report[key].some(f=>f.kind==='Evidence' && f.sourceIds.length)).length;
  $('#score-value').textContent=covered;
  $('#score-ring').style.setProperty('--score',covered/3*100);
  $('#score-ring').setAttribute('aria-label',`${covered} of 3 research areas contain sourced observations. Not an idea score.`);
  $('#coverage-copy').textContent=`${covered} of 3 areas have sourced observations: competitors, customers and market. Coverage does not measure evidence quality.`;
  $('#source-total').textContent=`${report.sources.length} linked sources · No success score`;
  $('#result-title').textContent = report.verdict;
  $('#result-summary').textContent = report.summary;
  const verdicts={'Worth testing':['Promising · test first','promising'],'Differentiate first':['Needs work · differentiate','mixed'],'Evidence is limited':['Inconclusive · more evidence needed','limited'],'Reconsider the approach':['Weak case · rethink','weak']};
  const [label,tone]=verdicts[report.verdict] || verdicts['Evidence is limited'];
  $('#verdict-level').textContent=label;$('#verdict-level').className='verdict-level '+tone;
  $('#aside-risk').textContent=report.risks[0]?.title || 'Willingness to pay is unproven';
  $('#aside-next').textContent=report.tests[0]?.title || 'Speak with prospective buyers';
  $('#idea-recap').textContent = brief().idea;
  const details=$('#research-details');details.replaceChildren();
  details.append(element('p',`Researched ${new Date(report.generatedAt).toLocaleString()}. Source publication dates may be older. Check linked sources before deciding.`,'research-timestamp'));
  const nav=$('#report-nav');nav.replaceChildren(element('p','EXPLORE YOUR REPORT','aside-label'));
  for(const [key,label,num,description] of reportSections){
    const section=element('section',undefined,'report-section section-'+key);section.id='report-'+key;
    const heading=element('header',undefined,'report-section-heading');
    const text=element('div');const h=element('h3',label);h.id='heading-'+key;section.setAttribute('aria-labelledby',h.id);text.append(h,element('p',description));
    heading.append(element('span',num,'section-number'),text,element('span',String(report[key].length),'section-count'));section.append(heading);
    const jump=element('a');jump.href='#report-'+key;jump.append(element('span',label),element('span',String(report[key].length)));nav.append(jump);
    const grid=element('div',undefined,'findings-grid');
    if(key==='tests'){
      grid.append(element('p','Pass / change-course thresholds are proposed decision rules, not statistical proof.','test-note'));
      report.tests.forEach((test,i)=>{
        const card=element('article',undefined,'finding-card test-card');card.append(element('span',`EXPERIMENT ${String(i+1).padStart(2,'0')} · THIS WEEK`,'test-kicker'),element('h4',test.title),element('p',test.action));
        const measure=element('p',undefined,'test-measure');measure.append(element('strong','Measure: '),document.createTextNode(test.measure));card.append(measure);
        const rules=element('div',undefined,'test-rules');for(const [name,title] of [['pass','Continue if'],['fail','Change course if']]){const rule=element('div',undefined,'test-rule '+name);rule.append(element('strong',title),element('p',test[name]));rules.append(rule);}card.append(rules);grid.append(card);
      });
    }else if(key==='unknowns'){
      const list=element('ul',undefined,'unknown-list');report.unknowns.forEach(x=>list.append(element('li',x)));grid.append(list);
    }else report[key].forEach(item=>grid.append(findingCard(item,report.sources)));
    if(!report[key].length)grid.append(element('p','No sufficiently supported findings in this research run.','empty-finding'));
    section.append(grid);details.append(section);
  }
  details.append(element('p','Public posts are a selective sample. Competitor traction is not proof of your demand. Test willingness to pay with real prospective buyers.','research-timestamp'));
  form.classList.add('hidden');results.classList.remove('hidden');restartButton.classList.remove('hidden');
  $('#quiz-shell').classList.add('showing-results');$('#question-aside').classList.add('hidden');$('#verdict-aside').classList.remove('hidden');
  $('#step-label').textContent='YOUR RESEARCH REPORT';
  $('#quiz-shell').scrollIntoView({behavior:'smooth',block:'start'});
}
async function runResearch() {
  if (busy) return;
  const input = brief(), fingerprint = JSON.stringify(input);
  if (!savedResearch || savedResearch.fingerprint !== fingerprint || savedResearch.expires < Date.now()) savedResearch = {fingerprint, expires:Date.now()+25*60_000, tracks:{}};
  controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 115_000);
  setBusy(true); status.className = 'field-help'; status.textContent = 'Searching competitors, public customer feedback and market evidence… This can take 1–2 minutes.';
  try {
    if (!savedResearch.plan) savedResearch.plan = await request({action:'plan',brief:input});
    const tracks = ['competitors','customers','market'];
    const attempts = await Promise.allSettled(tracks.map(async track => {
      if (!savedResearch.tracks[track]) savedResearch.tracks[track] = await request({action:'research',track,brief:input,planToken:savedResearch.plan.token});
    }));
    const failed = attempts.find(x => x.status === 'rejected');
    if (failed) throw failed.reason;
    status.textContent = 'Comparing evidence, checking possible gaps and preparing your tests…';
    const report = await request({action:'report',brief:input,tokens:tracks.map(t=>savedResearch.tracks[t].token)});
    render(report);
  } catch (error) {
    status.className = 'error';
    status.textContent = error.name === 'AbortError' ? 'Research timed out. Your answers are kept; please retry.' : error.message;
  } finally { clearTimeout(deadline); setBusy(false); }
}
nextButton.addEventListener('click', () => { if (busy || !valid()) return; step < 6 ? updateStep(step + 1) : runResearch(); });
backButton.addEventListener('click', () => { if (!busy) updateStep(Math.max(1,step-1)); });
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {event.preventDefault(); nextButton.click();} });
fields.forEach(name => {
  const input = $('#' + name);
  input.addEventListener('input', () => {$('#'+name+'-count').textContent = `${input.value.length} / ${input.maxLength}`; $('#'+name+'-error').textContent = '';});
});
restartButton.addEventListener('click', () => {
  $('#quiz-shell').classList.remove('showing-results');$('#question-aside').classList.remove('hidden');$('#verdict-aside').classList.add('hidden');
  results.classList.add('hidden'); form.classList.remove('hidden'); restartButton.classList.add('hidden'); status.textContent = ''; updateStep(1);
});
document.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => {
  if (!busy && !results.classList.contains('hidden')) restartButton.click();
  $('#validator').scrollIntoView({behavior:'smooth',block:'start'});
  if (!busy) $('#'+fields[step-1]).focus({preventScroll:true});
}));
$('#upgrade-button').addEventListener('click', () => {
  if (!lastReport) return;
  const text = ['IDEAPROOF — MARKET EVIDENCE', lastReport.generatedAt, 'Analyst judgment: '+lastReport.verdict, lastReport.summary];
  for (const key of ['competitors','customers','market','gaps','risks']) {
    text.push('\n'+key.toUpperCase());
    lastReport[key].forEach(i=>text.push(`${i.title} [${i.kind}; ${i.date}]\n${i.detail}\nLimit: ${i.limitation}\nSources: ${i.sourceIds.join(', ')}`));
  }
  text.push('\nSEVEN-DAY TESTS'); lastReport.tests.forEach(t=>text.push(`${t.title}\n${t.action}\nMeasure: ${t.measure}\nProposed pass: ${t.pass}\nProposed fail: ${t.fail}`));
  text.push('\nUNKNOWNS',...lastReport.unknowns,'\nSOURCES'); lastReport.sources.forEach(s=>text.push(`${s.id}: ${s.title}\n${s.url}`));
  const url = URL.createObjectURL(new Blob([text.join('\n\n')],{type:'text/plain;charset=utf-8'}));
  const link = element('a'); link.href=url; link.download='ideaproof-research.txt'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
updateStep(1);
