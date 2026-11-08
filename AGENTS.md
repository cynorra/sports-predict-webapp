# Soccer Games Today - project rules

English-language (en-US) football prediction + editorial site. Astro 5 (static) + React island for `/predict`, `/leaderboard`, and `/profile`. Firebase (Auth + client Firestore + admin Firestore REST scoring in GitHub Actions) is live and operational.
Rules below are adapted from `D:\android-projeler\yukle-next\universal-adsense-site-standard.md` (read it for the reasoning).

## Top rule: nothing untrue gets published
- The site has a real prediction model (Elo + Poisson, `src/lib/model.ts`, described on `/methodology`), so "our model" is fine.
- It has NO scouts, analysts, insiders, surveys, hands-on testing or match attendance. Never write "we tested/analyzed/found", "our data/analysts/sources", "I've seen", "as a former scout".
- Numbers need a named public source. Title, description and short answer contain no percentages/currency.
- No betting advice, tipster language, bookmaker names or affiliate links. The site is a free prediction game.
- Pages must not describe features that do not exist yet. Currently live features: free score predictor, Google sign-in pick persistence, nickname configuration, public leaderboard, personal history profile, and a football results page (`/results`, final scores of the main European competitions, refreshed ~3x/day, NOT live) and a schedule page (`/soccer-games-today`, scheduled games for today and the next 3 days, US Eastern kickoff times, `scripts/sync-upcoming.mjs`, NOT live).
- `methodology` / `editorial-policy` promise things (published track record, human review of every article). Keep those promises true or soften the text.

## Enforcement (code, not prompts)
- `npm test` - unit tests for the gates (`scripts/lib/article-quality.test.mjs`).
- `npm run audit` - runs on every post (guides and analysis also need a `## Sources` section: 3+ named, deep-linked references incl. a non-Wikipedia primary source; `scripts/lib/source-quality.mjs`): SEO lengths, word counts, FAQ/H2 minimums, keyword placement and stuffing, leftover template text, cross-post similarity (max 12% 5-gram overlap), H2 skeleton variety (max 3 identical per section), plus `validateArticle()` truthfulness gates.
- `npm run build` runs tests -> audit -> astro build; a failing post blocks the build.
- `npm run freshness` - lists posts not reviewed for 60+ days. Report only. Only set `updatedAt` after a real content change.

## Publishing
- New post: write it by hand with real facts, add `queued: true`, run `npm run schedule`. Queued/future-dated posts are hidden from pages, sitemap, `llms.txt`, RSS.
- Rhythm: Mon-Fri only, 4-day blocks shuffled from [1,1,2,0], 09:00-17:00 US Eastern, >=3h apart. `PUBLISH_WEEKENDS=true` turns weekends on (football previews).
- `POSTS_PER_DAY=1 npm run schedule` gives exactly one post per publishing day. This is the chosen pace (one post per weekday) so every post can be read by the author before it goes live; do not raise it unless review capacity grows. Links to posts that are queued or dated in the future are rendered as plain text at build time (`scripts/lib/hide-unpublished-links.mjs`) and become links when the post goes live.
- Every post must be read by the author (Eren Şimşir) before its go-live date, because the editorial policy says the author is responsible for what is published. AI-drafted posts are not exempt.
- `publishedAt` is the real go-live time. Never back-date. `.github/workflows/publish-scheduled.yml` redeploys when a post goes live.
- Every post: unique structure, 3-8 FAQ items (vary), short answer box, at least 2 internal links and 1 external source link.
- Match analysis / news need real data (fixtures, form, injuries from a named API/source). Do not invent them.

## Security rules (no secrets in the repo)
- API keys/tokens/hook URLs exist ONLY as GitHub Actions secrets (`FOOTBALL_DATA_TOKEN`, `SPORTAPI_KEY`, `DEPLOY_HOOK_URL`, `FIREBASE_SERVICE_ACCOUNT`) or host env vars. Never in code, workflows, docs, commits or chat-derived files. `.env*` is gitignored; `.env.example` has empty values.
- `npm run secrets` (`scripts/check-secrets.mjs`) scans the project; it runs in `npm run build` and in both workflows. It prints file:line and rule only, never the value.
- Workflows: `permissions: {}` by default, per-job least privilege, actions pinned to commit SHAs (Dependabot updates them), secrets passed to a single step, no `npm install` (scripts use only Node built-ins), fork guard `cynorra/sports-predict-webapp`.
- `refresh-data.yml` refreshes fixtures + ratings + results (`scripts/sync-results.mjs`, SportAPI, 5 requests per run; free plan = 2,000/day and 14,000/month) 3x/day and commits only when data changed. `publish-scheduled.yml` redeploys when a post goes live. `score-predictions.yml` scores matches every 3h.
- `public/_headers` sets security headers; CSP is Report-Only until verified with real AdSense/Funding Choices traffic.
- Public by design (not secrets): `PUBLIC_ADSENSE_CLIENT`, the AdSense publisher ID in ads.txt, Firebase public web config (protect Firestore with security rules, never ship firebase-admin credentials).
- A token pasted in chat counts as exposed: rotate it at the provider.

## Done since
- Consent banner (`src/components/ConsentBanner.astro`) is the only place the AdSense script is injected; nothing loads before "Accept". EEA/UK traffic needs a certified CMP (Funding Choices) after approval.
- `/predict` shows real fixtures only: `FOOTBALL_DATA_TOKEN=... npm run fixtures` (football-data.org results -> our own Elo, `scripts/lib/elo.mjs`; ClubElo was down and is no longer used) writes `src/data/fixtures.json`; with no file it shows an empty state. Clubs with < 10 rated matches are skipped. Raw API responses are cached in `scripts/.cache` (gitignored).
- Audit fails on orphan posts (every post needs an inbound body link from another post), `/site-map` page, `ads.txt` stub, 404 page, accessibility statement.
- Firebase integration (project `mac-tahmin-website`): Google sign-in enabled, Firestore created, `firestore.rules` deployed (anonymous reads of predictions/users/unknown collections return 403; fixtures are public). Fixtures mirrored by `refresh-data.yml`.
- Scoring workflow: `score-predictions.yml` (every 3h) runs `scripts/score-predictions.mjs` with the service account: stores 90-minute results on `fixtures/*`, computes points (`scripts/lib/scoring.mjs`), writes `leaderboard/{uid}`, `predictions/*.points`, `fixtures/*.community*`. Nicknamed users appear on the public leaderboard. `/leaderboard` reads via Firestore REST (zero SDK overhead for visitors); `/profile` shows personal pick history.
- Author bio page for Eren Şimşir (E-E-A-T) - live at `/author`, linked in article metadata, footer and about page with Schema.org Person markup.
- Match analysis previews - live at `/analysis` with model scoreline, win probabilities card and link to predictor game. First live post: `barcelona-vs-aston-villa-prediction.md`.
- User flow polish: direct "My Profile" navigation button in `PredictionBoard`, visual ranking badges (gold/silver/bronze) in `LeaderboardTable`.

- `/guides` is a topic-grouped hub (`src/components/GuidesHub.astro`, topics in `src/lib/guide-topics.ts`; a guide missing from the topic list lands in "More guides"). Keyword research (Keyword Planner export, US) maps to guides: score-prediction variants -> how-to-predict-football-scores and /predict; top-scorer records -> the records guides. Record guides must cite named sources (FIFA, UEFA, Opta Analyst, Premier League) and be re-checked as seasons progress.
- Results page (`/results`): `scripts/sync-results.mjs` writes `src/data/results.json` from SportAPI (sportapi.ai). The key stays server-side (SportAPI terms forbid client-side keys); a missing key, a failed call or a 429 leaves the file untouched. The page says it is not live and names the source. Its nav link only appears when the file exists.
- Cover images and figures are generated by `npm run images` with outlined text in Barlow Condensed (opentype.js); the site's own face is self-hosted via @fontsource (no Google Fonts requests).

## Open items
- GitHub repo: https://github.com/cynorra/sports-predict-webapp (public). Secrets set: FIREBASE_SERVICE_ACCOUNT, FOOTBALL_DATA_TOKEN (rotate the token: it was pasted in chat). The service-account JSON was deleted locally; a copy may remain in Downloads.
- Real domain: `SITE_URL`, `robots.txt` sitemap line, `contact@your-domain.com`, `DEPLOY_HOOK_URL` secret.
- Consent banner was tested in a fresh Chrome origin on 2026-10-29 (fresh: banner shown, 0 ad requests; reject: 0 requests across pages; accept: script injected only then). Repeat on the real domain before enabling ads, and with Funding Choices once AdSense is approved.
- Live test end-to-end: verify full automated scoring after the first Champions League match settlements (Nov 3-4, 2026).
- Fill `public/ads.txt` after AdSense approval; submit sitemap to Search Console and Bing.
