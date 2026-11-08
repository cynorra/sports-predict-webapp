---
title: "Expected Points in Football (xPts): A Worked Example"
description: "Expected points in football turn match probabilities into a fair points tally. See how xPts is calculated, a worked example and why it beats the real table."
answer: "Expected points weigh each possible result by its chance: three points times the win probability plus one point times the draw probability. Summed over a season, xPts shows what a team's chances deserved, not what luck delivered."
publishedAt: 2026-11-13T20:22:00.000Z
sport: football
image:
  src: "/images/expected-points-xpts-football-explained.svg"
  alt: "Soccer Scores Today cover with two bars comparing expected points and actual points for a football match with a home-win chance near fifty percent"
keywords: ["expected points in football", "xpts football", "expected points explained", "xpts vs actual points"]
faq:
  - q: "What does xPts mean?"
    a: "Expected points: the average number of league points a team would collect from a match, given the chances of a win, a draw and a defeat."
  - q: "How is xPts calculated?"
    a: "Multiply the win probability by three, add the draw probability, and that is the home side's expected points. Do the same for the other side with its own win and draw chances."
  - q: "Where do the probabilities come from?"
    a: "Either from a rating model, as on this site, or from the quality of the shots in the match, usually by simulating the chances thousands of times."
  - q: "Is xPts better than the league table?"
    a: "It is a different view. The table records what happened; xPts estimates what the performances deserved. Large gaps between the two often shrink later."
---

A league table counts points, and points are earned by results, which include a large dose of luck. Expected points, usually written xPts, is a way of asking a fairer question: given how a match was played or how likely each result was, how many points should a team have expected? The idea is simple enough to calculate by hand, and it turns a list of probabilities into something you can compare with the real table.

## The formula

For one match, a team can earn three points with its win probability, one with its draw probability and none otherwise. So:

**Expected points = 3 × P(win) + 1 × P(draw)**

Nothing else is needed. Add the result for each match across a season and you have the team's xPts total.

## A worked example

Take the match used elsewhere on this site: two sides where the model expects the hosts to score 1.6 goals and the visitors 1.2. Using the [Poisson model](/guides/poisson-distribution-football-goals-explained), the chances come out at about 47% for a home win, 25% for a draw and 29% for an away win.

- Home side: 3 × 0.47 + 0.25, which is about 1.65 expected points.
- Away side: 3 × 0.29 + 0.25, which is about 1.11 expected points.

Notice what this says. Whichever way the match goes, one team will pick up 3 or 0 and the other 0 or 3, or both get 1. Nobody can score 1.65 points in a single match. The number is an average over many identical games, which is why xPts is most useful when summed across a season.

<figure>
<img src="/images/expected-points-xpts-football-explained-bars.svg" alt="Bars comparing expected points of 1.65 for the home side and 1.11 for the away side with the three possible actual outcomes of 3, 1 and 0 points" width="1200" height="572" loading="lazy" decoding="async">
<figcaption>Expected points for the example match, shown next to the points that can actually be earned.</figcaption>
</figure>

## Two ways to get the probabilities

1. **From a rating model.** A rating system such as [Elo](/guides/elo-ratings-in-football-explained) gives expected goals, and the Poisson step gives win, draw and loss chances. This is the approach on the site's [methodology page](/methodology).
2. **From shot quality.** Many analysts take the list of shots in a match, assign each an [expected goals](/guides/what-is-xg-expected-goals-explained) value, then simulate the match many times with those shot chances. The share of simulations each side wins gives the probabilities, and the formula gives xPts.

The first method looks forward; the second looks back at what actually happened on the pitch. Both end with the same three-and-one formula.

## What xPts is used for

- **Spotting luck.** A team with 10 more points than its xPts has probably had fortune in tight games. A team with 10 fewer may have been unlucky.
- **Judging a manager or system.** If xPts rises after a change of style, the underlying performance improved even if results have not caught up.
- **Forecasting.** Teams that have outperformed xPts often drift back toward it, a pattern known as regression to the mean. See the guide on [form and luck](/guides/small-samples-and-football-form-luck-or-skill).

## Reading a gap between xPts and points

Suppose a team has 50 points and an xPts total of 42. The gap of eight points is roughly the effect of several close games going its way: narrow wins in matches the model rated as toss-ups, a few late goals, perhaps some unusually clinical finishing. Over the following matches the team is likely to collect fewer points than its table position would lead you to expect, not because it will suddenly play badly but because lucky margins rarely repeat. The opposite is true for a team well below its xPts, which may deserve a better position than it holds.

Two cautions apply. A very good team can beat its xPts for years, since elite finishing and goalkeeping are real skills. And xPts is built from models, so a gap can also mean the model is missing something about the team.

## Limits to keep in mind

- **It depends on the model.** Different xG providers give different shot values, so two sources can report different xPts for the same match.
- **It ignores game state.** A team that scores early and then sits back will create fewer shots, so a shot-based xPts can understate how comfortably it controlled the match.
- **It is not a prediction of the table.** A large gap between actual and expected points suggests fortune, but it does not say when the gap will close.

## A simple season check

Add up the expected points for each of a team's 38 matches and compare the total with its actual points. If the two are close, the table position is probably fair. If they differ widely, treat the table with caution when you decide how much form to put into a pick on the [prediction page](/predict). For a data source with xG and match-by-match numbers, [FBref](https://fbref.com) publishes expected goals for the major leagues so you can build your own sums.

## Sources

- [Expected goals, Wikipedia](https://en.wikipedia.org/wiki/Expected_goals), Wikipedia. How shot-based probabilities, from which xPts is derived, are built.
- [Maher (1982), "Modelling association football scores"](https://doi.org/10.1111/j.1467-9574.1982.tb00782.x), Statistica Neerlandica. The Poisson match model behind the worked example.
- [Hvattum and Arntzen (2010), "Using ELO ratings for match result prediction in association football"](https://doi.org/10.1016/j.ijforecast.2009.10.002), International Journal of Forecasting. Rating-based result probabilities as an input.
