# IdeaProof

Static UI with server-side Tavily search and Groq evidence analysis on Netlify.

## Setup
Set TAVILY_API_KEY and GROQ_API_KEY as secret Netlify environment variables available to Functions in Production. Optional GROQ_MODEL: openai/gpt-oss-20b (default) or openai/gpt-oss-120b. Gemini is no longer used. Redeploy after changing environment variables. Never commit keys or add them to frontend code.

Build: `node build.mjs`. Tests: `node --test tests/*.test.mjs`.

## Research
A Groq request plans three queries. Three Tavily advanced searches retrieve competitor, customer and market excerpts. A final Groq request synthesizes the report. Signed, brief-bound packets expire after 30 minutes. The browser reuses successful stages for 25 minutes when retrying. Each full run uses three advanced searches (six Tavily credits) and two Groq calls. Provider limits apply; this is not unlimited. Missing/failed services never return fake scores.

Citations are restricted to retrieved URLs. Source IDs are validated, but factual support still requires human review. Excerpts may be incomplete, biased or old. Possible gaps are hypotheses; real buyer tests establish willingness to pay. No success probabilities are generated.

Only index.html, styles.css, app.js and favicon.svg are published. Briefs are sent to Groq; generated search queries go to Tavily. No database storage is added. Provider errors expose only safe status categories, never keys or raw requests.
