---
title: "ScoreRadar Prediction Game: How the Points Work"
description: "The ScoreRadar prediction game explained: ten points for an exact score, five for the right result and margin, three for the result, plus locks and ranking."
answer: "In the ScoreRadar prediction game an exact score earns 10 points, the correct result with the right goal difference earns 5 and the correct result alone earns 3. Picks lock at kickoff and are scored on the 90-minute result."
publishedAt: 2026-11-27T17:39:00.000Z
sport: football
image:
  src: "/images/how-points-work-in-the-scoreradar-prediction-game.svg"
  alt: "ScoreRadar cover with three tiers of points: ten for an exact score, five for the right result and goal difference, three for the right result"
keywords: ["scoreradar prediction game", "score prediction game points", "football prediction game rules", "how prediction points are scored", "football score predictor", "soccer score predictions"]
faq:
  - q: "How many points is an exact score worth?"
    a: "Ten points. It is the only way to earn the top tier."
  - q: "When are my picks locked?"
    a: "Each pick locks when its match kicks off. You can change a pick any time before then."
  - q: "Do extra time and penalties count?"
    a: "No. Picks are scored on the result after 90 minutes plus stoppage time, so extra time and shootouts are ignored."
  - q: "Do I need to sign in?"
    a: "You can browse fixtures and the model's forecast without an account. To save picks and appear on the leaderboard, sign in with Google and choose a nickname."
  - q: "Is there any money involved?"
    a: "No. It is a free game for fun and bragging rights. There are no stakes, prizes paid for picks or bookmaker links."
---

The ScoreRadar prediction game is a free football (soccer) score predictor: choose a scoreline for an upcoming match, collect points when the match is over, and climb the leaderboard. The rules are short, but a few details change how you should pick, so this page sets them out in one place. Everything here describes how the game works today.

## The three scoring tiers

When a match finishes, each pick is compared with the real result:

| Your pick | Points |
| --- | --- |
| The exact score | 10 |
| The right winner (or a draw) and the right goal difference | 5 |
| The right winner (or a draw) only | 3 |
| Anything else | 0 |

The tiers are checked from the top, so a pick is only ever paid once, at the highest tier it reaches. A short worked example makes the second tier clear. You pick 2-0 for the home side:

- Final score 2-0: exact, 10 points.
- Final score 3-1: same result and same two-goal margin, 5 points.
- Final score 1-0: right winner, different margin, 3 points.
- Final score 1-1: wrong result, 0 points.

A draw pick follows the same pattern. If you pick 1-1 and the match ends 0-0, you have the right result and the same goal difference of zero, so you receive 5 points.

<figure>
<img src="/images/how-points-work-in-the-scoreradar-prediction-game-tiers.svg" alt="Three bars showing the points for an exact score, for the right result with the right goal difference, and for the right result alone: ten, five and three" width="1200" height="552" loading="lazy" decoding="async">
<figcaption>The three scoring tiers. Most points come from getting the margin right, not just the winner.</figcaption>
</figure>

## What result is used

Points are awarded on the score at the end of 90 minutes plus stoppage time. If a knockout match goes to extra time, the score used is the one before extra time began, and penalty shootouts are never part of it. The reasoning is explained in the guide to [extra time and penalty shootouts](/guides/extra-time-and-penalty-shootouts-explained).

## Locks and timing

- You can change a pick as often as you like until the match kicks off.
- At kickoff the pick locks and cannot be edited.
- Points appear a few hours after the final whistle, once the official result has been fetched from [football-data.org](https://www.football-data.org) and scored.

Locking at kickoff means nobody can use the first half to guess the final score. Because picks stay editable until then, late team news such as a surprise lineup can still be factored in.

## Signing in, nicknames and the leaderboard

You can look at the fixtures and the model's forecast without an account. To save your picks, you sign in with Google, which stores them under your account so they come back on another device. To appear on the public [leaderboard](/leaderboard), you also choose a nickname. The table ranks players by total points first and exact scores second, and your own history is on your private profile page.

## How to pick with these rules in mind

The tiers reward picks that get the margin right, not just the winner:

1. **Chase the margin, not only the winner.** Five points for the right goal difference is worth far more than three for the winner alone.
2. **Remember that exact scores are rare.** Even a strong favourite scores a specific scoreline only a minority of the time. See the grid in the [score prediction guide](/guides/how-to-predict-football-scores).
3. **Do not ignore draws.** A draw earns the same tiers as any other result, and as the guide on [why draws happen](/guides/why-football-draws-happen-and-how-often) explains, they are common.
4. **Compare with the model.** Each fixture shows what the site's [Elo and Poisson model](/methodology) expects. Agreeing with it is not required, and beating it is the fun part.

## Frequently confused details

**Is the goal difference tier only for wins?** No. It applies to draws as well. A 0-0 pick on a 2-2 final scores 5 points, since the result is a draw and the goal difference is zero in both cases.

**Do I earn more for hard matches?** No. Every fixture uses the same tiers. A pick on a mismatch and a pick on an even game are worth the same, so the reward comes from accuracy, not from the choice of fixture.

**Can I see how others picked?** When at least ten players have picked a fixture and you have entered your own score, the game shows the split between home wins, draws and away wins. It is a useful comparison with the model and with your own pick.

## Fair play

The game is free to enter. There is no money involved, no cash prize for picks, and no affiliate links. Points are computed by a scheduled job on the server, not in your browser, so the leaderboard cannot be edited from the client. The [responsible play](/responsible-play) page explains the site's position on gambling.

## Sources

- [football-data.org API documentation](https://www.football-data.org/documentation/quickstart), football-data.org. The source of fixtures and results used for scoring.
- [IFAB Laws of the Game, Law 7: The Duration of the Match](https://www.theifab.com/laws/latest/the-duration-of-the-match/), International Football Association Board. Why the scored result is the score after 90 minutes plus stoppage time.
- [IFAB Laws of the Game, Law 10: Determining the Outcome of a Match](https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/), International Football Association Board. Why extra time and shootouts are separate from the match result.
