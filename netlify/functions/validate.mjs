import { PublicError, validateBrief, planResearch, research, signEvidence, verifyEvidence, synthesize } from '../../server/research.mjs';
export const config = { path: '/api/validate', rateLimit: { windowLimit: 12, windowSize: 180, aggregateBy: ['ip', 'domain'] } };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Request origin is not allowed.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
  const key = process.env.GROQ_API_KEY;
  const searchKey = process.env.TAVILY_API_KEY;
  if (!key || !searchKey) return json({ error: 'Live research is not connected yet. Please try again after the site owner enables it.', code: 'NOT_CONFIGURED' }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 320_000) throw new PublicError('Request is too large.', 413);
    let data;
    try { data = JSON.parse(raw); } catch { throw new PublicError('Invalid JSON.'); }
    const brief = validateBrief(data.brief);
    const model = ['openai/gpt-oss-20b','openai/gpt-oss-120b'].includes(process.env.GROQ_MODEL) ? process.env.GROQ_MODEL : 'openai/gpt-oss-120b';
    if (data.action === 'plan') return json({token:signEvidence(await planResearch(brief,key,model),brief,key)});
    if (data.action === 'research') {
      const plan = verifyEvidence(data.planToken,brief,key);
      if (plan.track !== 'plan' || !['competitors','customers','market'].includes(data.track)) throw new PublicError('Invalid research plan.');
      const evidence = await research(data.track, brief, searchKey, plan.queries[data.track]);
      return json({ token: signEvidence(evidence, brief, key), track: evidence.track, sourceCount: evidence.sources.length });
    }
    if (data.action === 'report') {
      if (!Array.isArray(data.tokens) || data.tokens.length !== 3) throw new PublicError('Complete all three research tracks first.');
      const evidence = data.tokens.map(token => verifyEvidence(token, brief, key));
      if (new Set(evidence.map(x => x.track)).size !== 3 || evidence.some(x => !['competitors','customers','market'].includes(x.track))) throw new PublicError('All research tracks are required.');
      return json(await synthesize(brief, evidence, key, model));
    }
    throw new PublicError('Unknown request.');
  } catch (error) {
    if (error instanceof PublicError) return json({ error: error.message }, error.status);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return json({ error: 'Research took too long. Your answers are kept; please retry.' }, 504);
    return json({ error: 'Research could not finish. Your answers are kept; please retry.' }, 502);
  }
}
