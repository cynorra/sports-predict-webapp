---
title: "Clean Sheets in Soccer: How Often Should a Team Keep One?"
description: "Clean sheets in soccer depend on the opponent's chances as much as the defence. See how often to expect one, what the maths says and how to use it."
answer: "Clean sheets in soccer mean conceding no goals. When the opponent is expected to score about 1.2 goals, the chance of keeping a clean sheet is roughly three in ten, and it rises sharply against weaker attacks."
publishedAt: 2026-11-19T18:31:00.000Z
sport: football
image:
  src: "/images/clean-sheets-in-soccer-how-often-teams-keep-one.svg"
  alt: "Soccer Games Today cover with a falling curve showing the chance of a clean sheet shrinking as the opponent's expected goals rises"
keywords: ["clean sheets in soccer", "clean sheet probability", "how often clean sheets happen", "goalkeeper clean sheet stat"]
faq:
  - q: "What counts as a clean sheet?"
    a: "A clean sheet is a match in which a team concedes no goals. A 0-0 draw gives both sides one, and a 2-0 win gives one to the winners."
  - q: "How often does a team keep a clean sheet?"
    a: "Roughly a quarter to a third of matches for a typical side, depending on the league and the opponent. Strong defences against weak attacks do it much more often."
  - q: "Is a clean sheet the goalkeeper's achievement?"
    a: "Only partly. A clean sheet reflects the whole team's defending and the opponent's finishing, so a keeper on a strong team gets more of them regardless of personal skill."
  - q: "Can maths predict clean sheets?"
    a: "Yes, roughly. If you know the opponent's expected goals, the Poisson formula gives the chance they score zero."
---

A clean sheet, a match in which a team concedes no goals, is one of the most quoted defensive statistics. It is also an easy one to over-read. Whether a team keeps one depends on how many chances it allows and how well the opponent finishes, and a lot of that is chance. This guide shows how to estimate clean sheets with a one-line formula and what that means for your own picks.

## The formula

If a team's opponent is expected to score m goals, the chance of the opponent scoring none is, under the [Poisson model](/guides/poisson-distribution-soccer-goals-explained), simply e raised to the power of minus m. No other information is needed. For a few values of the opponent's expected goals:

| Opponent's expected goals | Chance of a clean sheet |
| --- | --- |
| 0.8 | about 45% |
| 1.0 | about 37% |
| 1.2 | about 30% |
| 1.35 | about 26% |
| 1.6 | about 20% |
| 2.0 | about 14% |

An average top-flight attack is expected to score around 1.3 to 1.4 goals, which makes a clean sheet about a one-in-four event for an average team. Strong defences facing weak attacks push the figure toward half.

<figure>
<img src="/images/clean-sheets-in-soccer-how-often-teams-keep-one-curve.svg" alt="Curve of the chance of a clean sheet falling from about 55% when the opponent is expected to score 0.6 goals to about 14% at 2.0 goals" width="1200" height="632" loading="lazy" decoding="async">
<figcaption>The chance of keeping a clean sheet as the opponent's expected goals rise. Computed with the Poisson formula.</figcaption>
</figure>

## Why the numbers surprise people

**Even the best defences concede often.** A team that keeps clean sheets in half its matches is doing very well against typical opposition. A side that keeps them in three matches out of four is either facing weak attacks or benefiting from luck.

**Clean sheets and winning are linked but not equal.** A team can win without a clean sheet (3-2) and keep one without winning (0-0). A goalless draw gives both sides a clean sheet but only one point each.

**Both teams keep one in a 0-0.** The probability of 0-0 itself is the product of two clean-sheet probabilities, which is why it is more common between two defensive sides.

## Who gets the credit

Clean sheets are often credited to the goalkeeper, and leagues give awards to the keeper with the most of them. That statistic mixes several things:

- The defenders' positioning and the team's pressing.
- The quality of the opposition's chances, not just their number.
- Luck, such as a shot that hits the post instead of going in.
- The goalkeeper's own saving ability.

To separate the keeper from the team, analysts compare goals conceded with the expected goals of the shots faced. See the guide to [expected goals](/guides/what-is-xg-expected-goals-explained) for how shot quality is measured.

## Using clean sheets in predictions

1. **Start from the opponent's expected goals, not the defender's reputation.** The formula above gives a baseline.
2. **Remember it is paired with a scoring chance.** A side with a 40% clean sheet chance and a decent attack often wins 1-0 or 2-0, which are common scorelines. The grid in the [score prediction guide](/guides/how-to-predict-soccer-scores) shows how.
3. **Do not read too much into a short run.** Four clean sheets in a row is less informative than it feels, for the reasons in the article on [form and luck](/guides/small-samples-and-soccer-form-luck-or-skill).
4. **Adjust for lineups.** A missing first-choice centre-back or goalkeeper changes the opponent's expected goals, and therefore the clean sheet chance.

## Home and away clean sheets

Home teams keep clean sheets more often than visitors, for the simple reason that the visitors are expected to score a little less. With the typical split of about 1.5 goals for the hosts and 1.2 for the visitors, the formula gives the home side a clean sheet chance of roughly three in ten and the visitors one in five. The gap is modest, but it adds up across a season and mirrors the [home advantage](/guides/home-advantage-in-soccer-how-big-is-it) effect in scoring.

## Clean sheets and the table

A side that keeps many clean sheets does not need to score a lot to collect points: a 1-0 win and a 0-0 draw are both built on a shutout. Teams with modest attacks but a tight defence can therefore sit higher than their goals scored suggest. If you compare two clubs with similar points, check how those points were earned, because the route tells you which of the two is more likely to repeat it.

## Quick sanity check

Pick a recent fixture and write down the visitors' expected goals, say 1.1. The home side's clean sheet chance is about e to the power of minus 1.1, which is roughly one in three. Now check how often home sides in that league keep clean sheets against comparable opposition. For published numbers by team and league, [FBref](https://fbref.com) lists goals conceded, clean sheets and expected goals against, which lets you compare the maths with real results.

## Sources

- [Clean sheet, Wikipedia](https://en.wikipedia.org/wiki/Clean_sheet), Wikipedia. Definition and use of the term.
- [Maher (1982), "Modelling association football scores"](https://doi.org/10.1111/j.1467-9574.1982.tb00782.x), Statistica Neerlandica. Independent Poisson goals, which give the probability of zero as e to the power of minus the average.
- [Poisson distribution, Wikipedia](https://en.wikipedia.org/wiki/Poisson_distribution), Wikipedia. The formula for the zero-goal probability.
