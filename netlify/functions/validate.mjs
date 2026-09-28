import { PublicError, validateBrief, research, signEvidence, verifyEvidence, synthesize } from '../../server/research.mjs';
export const config = { path: '/api/validate', rateLimit: { windowLimit: 12, windowSize: 180, aggregateBy: ['ip', 'domain'] } };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Request origin is not allowed.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'Live research is not connected yet. Please try again after the site owner enables it.', code: 'NOT_CONFIGURED' }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 320_000) throw new PublicError('Request is too large.', 413);
    let data;
    try { data = JSON.parse(raw); } catch { throw new PublicError('Invalid JSON.'); }
    const brief = validateBrief(data.brief);
    const configuredModel = process.env.GEMINI_MODEL?.trim();
    const model = /^gemini-[a-z0-9.-]+$/.test(configuredModel || '') ? configuredModel : 'gemini-3.1-flash-lite';
    if (data.action === 'research') {
      const evidence = await research(data.track, brief, key, model);
      return json({ token: signEvidence(evidence, brief, key), track: evidence.track, sourceCount: evidence.sources.length });
    }
    if (data.action === 'report') {
      if (!Array.isArray(data.tokens) || data.tokens.length !== 3) throw new PublicError('Complete all three research tracks first.');
      const evidence = data.tokens.map(token => verifyEvidence(token, brief, key));
      if (new Set(evidence.map(x => x.track)).size !== 3) throw new PublicError('All research tracks are required.');
      return json(await synthesize(brief, evidence, key, model));
    }
    throw new PublicError('Unknown request.');
  } catch (error) {
    if (error instanceof PublicError) return json({ error: error.message }, error.status);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return json({ error: 'Research took too long. Your answers are kept; please retry.' }, 504);
    return json({ error: 'Research could not finish. Your answers are kept; please retry.' }, 502);
  }
}
