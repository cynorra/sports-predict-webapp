---
title: "Poisson Distribution in Football: How Goals Are Modelled"
description: "The Poisson distribution in football turns average goals into scoreline odds. See a worked example, the formula, its known weaknesses and how to use it."
answer: "The Poisson distribution in football gives the chance of exactly 0, 1, 2 or more goals when you know the average number of goals a team scores. Football models use it to turn two goal averages into a table of scoreline probabilities."
publishedAt: 2026-11-09T21:43:00.000Z
sport: football
image:
  src: "/images/poisson-distribution-football-goals-explained.svg"
  alt: "ScoreRadar cover with a bar chart of goal probabilities for a team that averages 1.4 goals, with one goal and zero goals the most likely counts"
keywords: ["poisson distribution in football", "poisson model football goals", "football goal probability", "expected goals to scoreline"]
faq:
  - q: "Why is the Poisson distribution used for football goals?"
    a: "Goals are rare, countable events that arrive more or less independently over 90 minutes. The Poisson distribution is the standard tool for counting events like that when you only know the average rate."
  - q: "Is the Poisson model perfectly accurate for football?"
    a: "No. It slightly misjudges how often low scores such as 0-0 and 1-1 occur, and it ignores that teams change tactics after scoring. It is a useful baseline, not a perfect description."
  - q: "What do I need to calculate it?"
    a: "Only the average number of goals each team is expected to score in the match. From those two numbers you can compute the chance of every scoreline."
  - q: "Does the model know about injuries or form?"
    a: "Not by itself. Those factors only matter if you use them to adjust the two goal averages before you start."
---

When a commentator says a side is "due a goal", the claim hides a useful question: how many goals should we expect, and how surprised should we be by 0, 2 or 5? The Poisson distribution is the standard mathematical answer, and it sits underneath the score predictor on this site. This guide explains what it does in plain language, with one worked example you can repeat with a calculator.

## What the distribution actually does

The Poisson distribution describes how many times a random event happens in a fixed window when you know its average rate. It is used for counting rare, scattered events such as calls reaching a switchboard, and it fits football reasonably well because goals share three traits with such events:

- They are rare compared with the number of attacks.
- They can occur at any minute.
- One goal does not mechanically cause the next.

Feed it one number, the average goals expected from a team in this match, and it returns a probability for 0 goals, 1 goal, 2 goals and so on.

## A worked example with one team

Suppose a team is expected to score 1.4 goals. The formula gives these chances of scoring exactly that many:

| Goals scored | Chance |
| --- | --- |
| 0 | about 25% |
| 1 | about 35% |
| 2 | about 24% |
| 3 | about 11% |
| 4 | about 4% |
| 5 or more | about 1% |

<figure>
<img src="/images/poisson-distribution-football-goals-explained-bars.svg" alt="Bar chart of the chance of scoring 0 to 6 goals for a team averaging 1.4 goals per match, peaking at one goal with about 35%" width="1200" height="542" loading="lazy" decoding="async">
<figcaption>The Poisson shape for an average of 1.4 goals. Zero goals is almost as likely as two.</figcaption>
</figure>

Two things stand out. First, an average of 1.4 does not mean the team usually scores 1.4. It scores one goal more often than any other number, and it fails to score at all roughly one match in four. Second, the tail is thin: three or more goals happens in about one match in six, and a real rout is rare.

## From two teams to a scoreline

To forecast a match, run the calculation twice, once for each side, then multiply. If the home side averages 1.6 goals and the visitors 1.2, the chance of a 2-1 result is the chance the hosts score exactly two multiplied by the chance the visitors score exactly one. Repeat that for every pair of scores from 0-0 up to a sensible limit and you have a grid of scoreline probabilities.

Adding up cells gives the outcome probabilities:

- Every cell where the home number is larger is a home win.
- Every cell on the diagonal is a draw.
- Every cell where the away number is larger is an away win.

This is exactly what the grid in the [score prediction guide](/guides/how-to-predict-football-scores) shows, and it is how the [methodology](/methodology) page describes the site's own forecasts.

## Where the goal averages come from

The distribution is only as good as the two averages you feed in. A common route is to start from a rating, such as the [Elo ratings](/guides/elo-ratings-in-football-explained) of both clubs, convert the rating gap into a share of the league's typical goals, and add a [home advantage](/guides/home-advantage-in-football-how-big-is-it) bonus. Alternatives use shot quality, so see the explanation of [expected goals](/guides/what-is-xg-expected-goals-explained). Whichever input you choose, the Poisson step stays the same.

## Known weaknesses

Statisticians who have tested Poisson goal models on real leagues point out a few systematic flaws:

1. **Goals are not fully independent.** Teams that lead often defend and teams that trail take risks, so the two scores are slightly linked.
2. **Low scores are slightly off.** Real leagues show a few more 0-0 and 1-1 draws than the pure model predicts. Researchers have proposed small corrections, the best known being the Dixon and Coles adjustment from 1997.
3. **Averages are not fixed.** A red card or an early goal changes the rate for the rest of the match.

None of these ruins the method. They are the reason forecasts should be read as likelihoods and not as promises.

## Try it yourself

Pick two numbers, such as 1.5 and 1.0, and compute the chance of each team scoring 0, 1, 2 and 3 goals with the formula P(k) = e^(-m) × m^k / k!, where m is the average and k is the goal count. Multiply the chances for a few scorelines and you will see why 1-0, 1-1 and 2-1 dominate. If you want to check your arithmetic, the [Wikipedia article on the Poisson distribution](https://en.wikipedia.org/wiki/Poisson_distribution) lists the formula and its properties.

## Why a modest model is still worth having

A Poisson grid will not spot a hidden injury or a manager's tactical plan. What it does is keep your expectations honest. It reminds you that a heavy favourite still fails to score in a noticeable share of matches, and that no single scoreline is very likely. That discipline is what separates a considered pick on the [prediction page](/predict) from wishful thinking. Even extreme feats, such as the [most goals in a Premier League season](/guides/most-goals-in-a-premier-league-season), sit far in the tail of what a scoring model expects from one player in a match.

## Sources

- [Poisson distribution, Wikipedia](https://en.wikipedia.org/wiki/Poisson_distribution), Wikipedia. The formula and its properties.
- [Maher (1982), "Modelling association football scores"](https://doi.org/10.1111/j.1467-9574.1982.tb00782.x), Statistica Neerlandica. The first widely cited use of independent Poisson goals for football scores.
- [Dixon and Coles (1997), "Modelling association football scores and inefficiencies in the football betting market"](https://doi.org/10.1111/1467-9876.00065), Journal of the Royal Statistical Society Series C. The adjustment for low-scoring results and time-varying team strength.
