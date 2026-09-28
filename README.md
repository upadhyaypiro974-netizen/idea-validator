# IdeaProof — evidence before building

Source-linked market research with no numeric viability score or success prediction.

## Netlify activation

- Production branch: `main`. Base directory: blank.
- `netlify.toml` sets build command `node build.mjs`, publish directory `public`, and functions directory `netlify/functions`.
- Add `GEMINI_API_KEY` as a Netlify secret with Functions scope. Use a Google AI Studio project with Gemini API and Google Search grounding access. Never put the key in GitHub, frontend code or chat.
- Optional `GEMINI_MODEL`: defaults to `gemini-2.5-flash`; requires web search and structured outputs.
- Redeploy after configuring secrets. Run a real idea check and check citations before wider use.

No API key was available during implementation, so live provider behaviour and Netlify deployment have not been verified. Without a key the server returns an honest unavailable message, never invented research.

## Features

Existing CSS and design are unchanged. Six contextual questions cover the idea, buyer, geography, alternatives, differentiation/price and customer evidence. Three search requests cover competition, customer feedback and market evidence, then one structured synthesis produces a concise report. It includes Evidence/Inference/Unknown labels, citations, date uncertainty, possible gaps, counterevidence, limitations, unknowns and seven-day tests with proposed pass/fail rules. Reports can be downloaded with sources. The nonfunctional payment placeholder is replaced by this download action; no payment integration was added.

## Reliability, privacy and cost

This is bounded public-web research, not exhaustive or continuously updated market coverage. Each full run uses three search-enabled model calls plus one synthesis call. Gemini free-tier quotas apply; availability varies by account/model. Paid-tier API and hosting usage can incur charges. Private groups, paywalls, local evidence and some reviews may be inaccessible. Customer feedback is a selective sample, not representative demand; competitor traction does not predict your sales. AI can misread evidence, so check the links.

The backend requires completed web search, extracts source URLs from Google grounding metadata, signs research against the idea and a 30-minute expiry, and rejects unknown citation IDs. These measures check provenance, not semantic correctness. The source count is a URL count, not a quality score. Gaps are hypotheses, and test thresholds are proposed decision rules rather than statistical proof.

Keys stay server-side. Answers go to Google Gemini and may inform search queries; the form tells users to avoid confidential details. The application stores no reports in a database; provider retention policies still apply. Temporary research lives only in page memory for retries. The application does not log answers, provider payloads or keys.

Netlify rate limiting: 12 endpoint requests per IP/domain in 180 seconds; four calls per run. Inputs, outputs and call duration are bounded. This is not a global spending cap or login system. Configure provider project usage controls before broad public use. No secret or paid account configuration was performed.

## Development

Node.js 22, no external runtime dependencies.

- `node build.mjs` copies only the four public website assets. Do not publish the repository root with backend files.
- `node --test tests/research.test.mjs` runs validation, citation/provenance, errors and mocked integration checks.
- Use Netlify Dev for local end-to-end testing with a local ignored `.env`.

## Research informing the change — 28 September 2026

Public first-party feature descriptions reviewed; this was not paid-product testing or an exhaustive survey.

| Product | Advertised approach | Design implication |
| --- | --- | --- |
| IdeaBuddy | Questionnaire based on planning assumptions plus a score | Self-assessment is not external demand evidence. |
| ValidatorAI | AI scoring, founder-platform behaviour and customer simulation | Founder activity and simulation are not real buyer purchases. |
| DimeADozen | Long citation-backed reports, competition and risks | Citations are already common; prioritize concise decisions and tests. |
| ValidateIdea | Sourced market/competitor analysis without scores | Use this evidence-first pattern with explicit unknowns and actionable experiments. |

These are design inferences, not claims that competitors never provide a particular feature.

Sources:
- https://ideabuddy.com/features/idea-validation/
- https://validatorai.com/faq
- https://www.dimeadozen.ai/startup-idea-validation
- https://validateidea.ai/

Technical references:
- https://ai.google.dev/gemini-api/docs/google-search
- https://ai.google.dev/gemini-api/docs/structured-output
- https://docs.netlify.com/build/functions/configuration/
- https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
