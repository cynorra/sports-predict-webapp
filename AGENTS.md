# SkorRadar - project rules

English-language (en-US) football prediction + editorial site. Astro 5 (static) + React island for `/predict`. Firebase (Auth + Firestore) is planned, not installed.
Rules below are adapted from `D:\android-projeler\yukle-next\universal-adsense-site-standard.md` (read it for the reasoning).

## Top rule: nothing untrue gets published
- The site has a real prediction model (Elo + Poisson, `src/lib/model.ts`, described on `/methodology`), so "our model" is fine.
- It has NO scouts, analysts, insiders, surveys, hands-on testing or match attendance. Never write "we tested/analyzed/found", "our data/analysts/sources", "I've seen", "as a former scout".
- Numbers need a named public source. Title, description and short answer contain no percentages/currency.
- No betting advice, tipster language, bookmaker names or affiliate links. The site is a free prediction game.
- Pages must not describe features that do not exist yet (leaderboard, accounts, saved predictions are not live).
- `methodology` / `editorial-policy` promise things (published track record, human review of every article). Keep those promises true or soften the text.

## Enforcement (code, not prompts)
- `npm test` - unit tests for the gates (`scripts/lib/article-quality.test.mjs`).
- `npm run audit` - runs on every post: SEO lengths, word counts, FAQ/H2 minimums, keyword placement and stuffing, leftover template text, cross-post similarity (max 12% 5-gram overlap), H2 skeleton variety (max 3 identical per section), plus `validateArticle()` truthfulness gates.
- `npm run build` runs tests -> audit -> astro build; a failing post blocks the build.
- `npm run freshness` - lists posts not reviewed for 60+ days. Report only. Only set `updatedAt` after a real content change.

## Publishing
- New post: write it by hand with real facts, add `queued: true`, run `npm run schedule`. Queued/future-dated posts are hidden from pages, sitemap, `llms.txt`, RSS.
- Rhythm: Mon-Fri only, 4-day blocks shuffled from [1,1,2,0], 09:00-17:00 US Eastern, >=3h apart. `PUBLISH_WEEKENDS=true` turns weekends on (football previews).
- `publishedAt` is the real go-live time. Never back-date. `.github/workflows/publish-scheduled.yml` redeploys when a post goes live.
- Every post: unique structure, 3-8 FAQ items (vary), short answer box, at least 2 internal links and 1 external source link.
- Match analysis / news need real data (fixtures, form, injuries from a named API/source). Do not invent them.

## Security rules (no secrets in the repo)
- API keys/tokens/hook URLs exist ONLY as GitHub Actions secrets (`FOOTBALL_DATA_TOKEN`, `DEPLOY_HOOK_URL`) or host env vars. Never in code, workflows, docs, commits or chat-derived files. `.env*` is gitignored; `.env.example` has empty values.
- `npm run secrets` (`scripts/check-secrets.mjs`) scans the project; it runs in `npm run build` and in both workflows. It prints file:line and rule only, never the value.
- Workflows: `permissions: {}` by default, per-job least privilege, actions pinned to commit SHAs (Dependabot updates them), secrets passed to a single step, no `npm install` (scripts use only Node built-ins), fork guard `cynorra/sports-predict-webapp`.
- `refresh-data.yml` refreshes fixtures + ratings 3x/day and commits only when data changed. `publish-scheduled.yml` redeploys when a post goes live.
- `public/_headers` sets security headers; CSP is Report-Only until verified with real AdSense/Funding Choices traffic.
- Public by design (not secrets): `PUBLIC_ADSENSE_CLIENT`, the AdSense publisher ID in ads.txt, a future Firebase web config (protect Firestore with security rules, never ship firebase-admin credentials).
- A token pasted in chat counts as exposed: rotate it at the provider.

## Done since
- Consent banner (`src/components/ConsentBanner.astro`) is the only place the AdSense script is injected; nothing loads before "Accept". EEA/UK traffic needs a certified CMP (Funding Choices) after approval.
- `/predict` shows real fixtures only: `FOOTBALL_DATA_TOKEN=... npm run fixtures` (football-data.org results -> our own Elo, `scripts/lib/elo.mjs`; ClubElo was down and is no longer used) writes `src/data/fixtures.json`; with no file it shows an empty state. Clubs with < 10 rated matches are skipped. Raw API responses are cached in `scripts/.cache` (gitignored).
- Audit fails on orphan posts (every post needs an inbound body link from another post), `/site-map` page, `ads.txt` stub, 404 page, accessibility statement.

## Open items
- GitHub repo: https://github.com/cynorra/sports-predict-webapp (public). Secrets set: FIREBASE_SERVICE_ACCOUNT, FOOTBALL_DATA_TOKEN (rotate the token: it was pasted in chat). The service-account JSON was deleted locally; a copy may remain in Downloads.
- Real domain: `SITE_URL`, `robots.txt` sitemap line, `contact@your-domain.com`, `DEPLOY_HOOK_URL` secret.
- Author bio page for Eren Simsir (E-E-A-T) - only real facts.
- Consent banner was tested in a fresh Chrome origin on 2026-10-29 (fresh: banner shown, 0 ad requests; reject: 0 requests across pages; accept: script injected only then). Repeat on the real domain before enabling ads, and with Funding Choices once AdSense is approved.
- Firebase (project `mac-tahmin-website`): Google sign-in enabled, Firestore created, `firestore.rules` published and verified on 2026-10-29 (anonymous reads of predictions/users/unknown collections return 403; fixtures are public). Fixtures are mirrored by `refresh-data.yml`. NOT yet tested: the actual Google sign-in + save flow in a browser; write-denial after kickoff.
- Scoring: `score-predictions.yml` (every 3h) runs `scripts/score-predictions.mjs` with the service account: stores 90-minute results on `fixtures/*`, computes points (`scripts/lib/scoring.mjs`, the only place points are computed), writes `leaderboard/{uid}`, `predictions/*.points`, `fixtures/*.community*`. Players appear on the public leaderboard only after choosing a nickname (privacy by default). `push-fixtures.mjs` merges (never replaces) fixture docs. `/leaderboard` reads via Firestore REST (no SDK for visitors); `/profile` shows the player's history.
- Not yet tested end to end: needs real finished matches + real predictions (first CL matches 3-4 Nov 2026).
- Fill `public/ads.txt` after approval; submit sitemap to Search Console and Bing.
