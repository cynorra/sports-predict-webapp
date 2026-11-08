# Soccer Scores Today

A free English-language football score prediction game with an editorial section (guides and match analysis).
Built with Astro 5 (static output) and a React island for `/predict`, `/leaderboard` and `/profile`.
Firebase handles sign-in and picks; scoring runs in GitHub Actions.

Project rules, editorial gates and open items are in [AGENTS.md](AGENTS.md).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests for the editorial and scoring gates |
| `npm run audit` | Content audit (SEO lengths, truthfulness gates, images, orphan pages) |
| `npm run images` | Regenerate cover images and figures from data |
| `npm run schedule` | Assign publish times to posts marked `queued: true` |
| `npm run freshness` | List posts not reviewed for 60+ days |
| `npm run build` | Tests, secret scan, audit, then `astro build` |

## Publishing a post

1. Write the post by hand in `src/content/guides` (or `analysis`), with real facts and a named source.
2. Add its cover and at least one figure to `scripts/images/build-images.mjs`, then run `npm run images`.
3. Set `queued: true`, run `npm run audit`, then `npm run schedule`.
