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
function findingCard(item, sources) {
  const card = element('article', undefined, 'idea-recap');
  card.append(element('span', `${item.kind.toUpperCase()} · ${item.date || 'Date unknown'}`), element('h4', item.title), element('p', item.detail));
  if (item.limitation) card.append(element('p', 'Limit: ' + item.limitation));
  const refs = element('p');
  for (const id of item.sourceIds) {
    const source = sources.find(s => s.id === id);
    if (!source) continue;
    const link = element('a', `[${id}] ${source.title}`);
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    refs.append(link, document.createTextNode(' '));
  }
  card.append(refs);
  return card;
}
function render(report) {
  lastReport = report;
  $('#score-value').textContent = report.sources.length;
  $('#score-ring').style.setProperty('--score', 0);
  $('#result-title').textContent = report.verdict;
  $('#result-summary').textContent = report.summary;
  $('#result-kicker').textContent = 'RESEARCH JUDGMENT · NOT A SUCCESS PREDICTION';
  $('#idea-recap').textContent = brief().idea;
  const firstGap = report.gaps[0];
  $('#strength-title').textContent = firstGap?.title || 'No clear gap established';
  $('#strength-copy').textContent = firstGap?.detail || 'Research has not established a distinctive opening yet.';
  const firstRisk = report.risks[0];
  $('#risk-title').textContent = firstRisk?.title || 'Demand remains unproven';
  $('#risk-copy').textContent = firstRisk?.detail || 'Public research cannot prove buyers will pay for your product.';
  // Summary cards are analyst interpretations; the evidence and limitations follow below.
  $('#test-title').textContent = report.tests[0].title;
  $('#test-copy').textContent = report.tests[0].action;
  const details = $('#research-details'); details.replaceChildren();
  for (const html of report.searchSuggestions || []) {
    const frame = document.createElement('iframe');
    frame.title = 'Google Search suggestions';
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.cssText = 'width:100%;height:160px;border:0;margin:12px 0';
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:">${html}`;
    details.append(frame);
  }

  details.append(element('p', `Research run: ${new Date(report.generatedAt).toLocaleString()}. Links show retrieved sources; publication dates may be older. Findings are AI interpretations and should be checked.`, 'field-help'));
  for (const [key, label] of [['competitors','Competitors & alternatives'],['customers','Customer evidence'],['market','Market signals'],['gaps','Possible gaps to test'],['risks','Risks & contrary evidence']]) {
    const section = element('section'); section.append(element('h3', label));
    if (!report[key].length) section.append(element('p','No sufficiently supported findings in this research run.','field-help'));
    report[key].forEach(item => section.append(findingCard(item, report.sources)));
    details.append(section);
  }
  const tests = element('section'); tests.append(element('h3','Your seven-day validation tests'), element('p','These thresholds are proposed decision rules, not statistical proof.','field-help'));
  report.tests.forEach(test => {
    const card = element('article',undefined,'idea-recap');
    card.append(element('h4',test.title),element('p',test.action),element('p','Measure: '+test.measure),element('p','Continue if: '+test.pass),element('p','Change course if: '+test.fail));
    tests.append(card);
  });
  details.append(tests);
  const unknowns = element('section'); unknowns.append(element('h3','What we still do not know'));
  const list = element('ul'); report.unknowns.forEach(x => list.append(element('li',x))); unknowns.append(list); details.append(unknowns);
  details.append(element('p','Public posts are a selective sample. Competitor traction is not proof of your demand. Test willingness to pay with real prospective buyers.','field-help'));
  form.classList.add('hidden'); results.classList.remove('hidden'); restartButton.classList.remove('hidden');
  $('#step-label').textContent = 'SOURCE-LINKED RESEARCH';
  $('#aside-title').textContent = 'Evidence before commitment.';
  $('#aside-copy').textContent = 'Read what supports the idea, what challenges it, and what to test next.';
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
async function runResearch() {
  if (busy) return;
  const input = brief(), fingerprint = JSON.stringify(input);
  if (!savedResearch || savedResearch.fingerprint !== fingerprint || savedResearch.expires < Date.now()) savedResearch = {fingerprint, expires:Date.now()+25*60_000, tracks:{}};
  controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 115_000);
  setBusy(true); status.className = 'field-help'; status.textContent = 'Searching competitors, public customer feedback and market evidence… This can take 1–2 minutes.';
  try {
    const tracks = ['competitors','customers','market'];
    const attempts = await Promise.allSettled(tracks.map(async track => {
      if (!savedResearch.tracks[track]) savedResearch.tracks[track] = await request({action:'research',track,brief:input});
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
