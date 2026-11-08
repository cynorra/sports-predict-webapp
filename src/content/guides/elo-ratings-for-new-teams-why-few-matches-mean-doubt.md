---
title: "Elo Ratings for New Teams: Why Few Matches Mean Doubt"
description: "Elo ratings for new teams start flat and need many matches to find the truth. See why a rating moves slowly, how long it takes and how this site handles it."
answer: "Elo ratings for new teams start at the same value as everyone else, so a strong newcomer looks average at first. The rating then climbs slowly, which is why a team needs many matches before its number deserves trust."
publishedAt: 2026-11-17T21:36:00.000Z
sport: football
image:
  src: "/images/elo-ratings-for-new-teams-why-few-matches-mean-doubt.svg"
  alt: "Soccer Scores Today cover with a rating line rising slowly from 1500 toward a higher true strength as the number of matches grows"
keywords: ["elo ratings for new teams", "elo rating starting value", "how fast elo converges", "elo rating reliability"]
faq:
  - q: "What rating does a new team start with?"
    a: "Every team starts at the same value, commonly 1500 in the version used on this site, so a new rating says nothing about real strength."
  - q: "How many matches does an Elo rating need?"
    a: "Dozens. With a typical update size, even a team much stronger than its opponents needs many matches to climb most of the way to its true level."
  - q: "Why does the site skip clubs with few matches?"
    a: "Their ratings are based on too little evidence. The model does not publish a prediction for a club with fewer than ten rated matches."
  - q: "Does a bigger update size fix it?"
    a: "It speeds up learning but makes ratings jumpier after every result, so there is a trade-off between speed and stability."
---

An Elo rating is a number that learns. It begins with a guess, then adjusts after every match by comparing what happened with what the rating predicted. That makes it very good at tracking established teams, and rather slow with newcomers. If you use ratings to make forecasts, as this site does for its score predictions, you need to know how long a rating takes to become reliable. This guide shows the answer with a worked example.

## Every team starts equal

The rating system on this site gives every club a starting value of 1500 and then updates it after each result. A newly promoted side, a newcomer to a competition or a club that has only just entered the data therefore starts on the same rating as a champion. That starting value carries no information about strength, so the model has to find the truth from results.

The update itself follows the logic in the [Elo ratings guide](/guides/elo-ratings-in-football-explained): the points won or lost depend on the surprise in the result, scaled by a constant. Here the constant is 20, and the change grows with the goal margin, so a big win moves a rating more than a narrow one.

## A thought experiment: a strong team from a flat start

Suppose a club's true strength is 200 rating points above the typical opponent, and it plays opponents rated 1500 on neutral ground. A team that strong should score about 76% of the available points on average, counting a draw as half. The system does not know this. It starts at 1500, expects 50%, sees the team doing better, and nudges the rating upward. With every match the gap between expectation and reality shrinks, so the nudges shrink too.

Following that process with the constant of 20 (and ignoring the extra weight for big margins):

| Matches played | Rating |
| --- | --- |
| 5 | about 1525 |
| 10 | about 1546 |
| 20 | about 1580 |
| 40 | about 1626 |
| 60 | about 1653 |

<figure>
<img src="/images/elo-ratings-for-new-teams-why-few-matches-mean-doubt-curve.svg" alt="Curve of an Elo rating rising from 1500 to about 1653 over 60 matches for a team whose true strength is 1700" width="1200" height="672" loading="lazy" decoding="async">
<figcaption>The expected path of the rating of a team whose true strength is 1700, starting from 1500. Computed under simplified assumptions; real results add noise.</figcaption>
</figure>

After a full 38-match league season the rating would still be well short of 1700. That is not a flaw so much as a characteristic of a learning system: it prefers to move cautiously, because any single result is noisy.

## Noise on top of slowness

Real teams do not win exactly 76% of the time in a neat sequence. Results arrive in streaks, and the [Poisson model](/guides/poisson-distribution-football-goals-explained) shows how much random variation there is in scores. A new team may lose its first three matches by bad luck and look weak, or win its first three and look strong. Both are small samples, a theme covered in the guide to [form and luck](/guides/small-samples-and-football-form-luck-or-skill).

## The trade-off in the update size

The update constant sets the balance:

- **A larger constant** makes ratings react faster, but every upset moves them a lot, so they jump around.
- **A smaller constant** gives steadier ratings, but takes longer to learn.

There is no perfect value. Football rating systems usually pick a middle path and accept that new teams take time. Some systems use a larger constant for a team's first matches and a smaller one afterwards, but the version on this site keeps a single constant for simplicity.

## Linking leagues makes it harder

Domestic leagues rate their own clubs against each other, but they tell you little about how a club in one league compares with a club in another. Clubs from different leagues are only linked through the matches they play against each other, mostly in European competition. A team that has played few of those matches has a rating that is uncertain relative to the rest of Europe, even if it has played many domestic games. This is explained on the [methodology page](/methodology).

## Promoted clubs and the first months

A club that has just been promoted is the most common case. The site's ratings are built from the major leagues and the Champions League, so a club arriving from a lower division has no record in the data and starts at 1500, the same as every other club. A newly promoted side is usually weaker than average, so its early rating is likely to flatter it. The rating improves as results accumulate, but as the table above shows, it can still be catching up after a full season.

## What to do as a reader

When you see a forecast for a team with a short record, give less weight to the exact numbers. For a newly promoted side the model's view of a match may be too kind, so a close forecast can hide a real gap in quality. The same caution applies to the [expected goals](/guides/what-is-xg-expected-goals-explained) of any team that has played only a handful of matches.

## What this site does about it

The model does not publish a prediction for a club with fewer than ten rated matches. It is a simple safeguard: the number would exist, but it would reflect little more than the starting value. For clubs above that threshold, treat the rating as an estimate with a margin of error, especially for a promoted team or a club that has only recently entered the data. When you compare your own picks with the model on the [prediction page](/predict), remember that confidence in a rating grows with the matches behind it.

## Further reading

For the history of the rating system and the chess origin of the method, the [Wikipedia article on the Elo rating system](https://en.wikipedia.org/wiki/Elo_rating_system) is a reliable starting point.

## Sources

- [Elo rating system, Wikipedia](https://en.wikipedia.org/wiki/Elo_rating_system), Wikipedia. The update rule and the role of the K-factor.
- [Hvattum and Arntzen (2010), "Using ELO ratings for match result prediction in association football"](https://doi.org/10.1016/j.ijforecast.2009.10.002), International Journal of Forecasting. Evidence on rating-based forecasting in football.
- [World Football Elo Ratings, "About"](https://www.eloratings.net/about), eloratings.net. How an independent football Elo handles match importance and margin.
