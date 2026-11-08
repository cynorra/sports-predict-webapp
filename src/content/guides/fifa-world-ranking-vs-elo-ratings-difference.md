---
title: "FIFA World Ranking vs Elo Ratings: What Is the Difference?"
description: "The FIFA world ranking vs Elo ratings: both score national teams from results. See how they differ, why the 2018 change mattered and what they miss."
answer: "The FIFA World Ranking and Elo ratings both update after every result, but they differ in details such as match weights and goal margins. Both give more credit for beating strong opponents than weak ones."
publishedAt: 2026-11-23T19:33:00.000Z
sport: football
image:
  src: "/images/fifa-world-ranking-vs-elo-ratings-difference.svg"
  alt: "Soccer Games Today cover comparing two rating ladders of national teams, one labelled FIFA ranking and one labelled Elo rating"
keywords: ["fifa world ranking vs elo", "fifa ranking explained", "national team ratings", "elo for national teams"]
faq:
  - q: "Does the FIFA ranking use Elo?"
    a: "Since 2018 the men's FIFA ranking has used a method based on the Elo system: points are won or lost after each match depending on the result, the importance of the match and the strength of the opponent."
  - q: "What did the FIFA ranking use before 2018?"
    a: "An older formula that combined results over a four-year window with weights for match type and opponent. The change was made to react faster and to be easier to follow."
  - q: "Which is better for predicting matches?"
    a: "Either can work as a starting point. Ratings that reflect goal margins and recent form respond better to changes, but all rating systems miss injuries and lineups."
  - q: "Why do rankings differ from fans' opinions?"
    a: "Rankings reward results against comparable opponents, and weights favour competitive matches over friendlies, so they can disagree with reputation."
---

When pundits argue about which national team is strongest, they often quote one of two numbers: the FIFA World Ranking or an Elo rating. Both turn results into a single score, and both can be used as a starting point for a forecast. They are not the same thing, though, and understanding the differences stops you from over-reading either one.

## The shared idea

Both systems rest on a simple principle: a rating is an estimate of strength that moves after each match. Beat a strong team and your rating goes up by a lot. Beat a weak team and it barely moves. Lose to a weak team and you drop. The expected result comes from the gap between the two ratings, so the system is self-correcting: if a team keeps beating what the ratings predict, its number rises until the predictions catch up.

The mechanics of that update are covered in the [Elo ratings guide](/guides/elo-ratings-in-soccer-explained).

## The FIFA ranking

FIFA has published a men's world ranking since the early 1990s, and it changed its method in 2018. The older formula combined results over several years with fixed weights. The newer one adopted an approach based on the Elo model: after every match a team gains or loses points depending on:

- the result,
- the importance of the match, where World Cup matches weigh much more than friendlies, and
- the strength of the opponent, with a win against a higher-ranked team worth more.

Because a team's points are updated after each match rather than recalculated from a four-year window, the ranking reacts faster than before. FIFA publishes the official method and the current table on [fifa.com](https://www.fifa.com).

## Elo ratings for national teams

The World Football Elo Ratings, run by an independent site, apply Arpad Elo's chess method to national teams. They also weigh match importance, and they scale the change by goal margin, so a 4-0 win moves the rating more than a 1-0 win. They include a home-advantage term. Because the rating itself is the whole output, you can compute an expected score for any pairing from the gap, as the [Elo guide](/guides/elo-ratings-in-soccer-explained) shows.

<figure>
<img src="/images/fifa-world-ranking-vs-elo-ratings-difference-compare.svg" alt="Two columns comparing the FIFA ranking and Elo ratings by inputs: results, match importance and opponent strength in both, goal margin and home bonus handled differently" width="1200" height="572" loading="lazy" decoding="async">
<figcaption>A simplified comparison. The shared core is results, match importance and opponent strength; the details differ.</figcaption>
</figure>

## Where they differ in practice

| | FIFA ranking | Independent Elo ratings |
| --- | --- | --- |
| Purpose | Official ranking used for seeding and reputation | Strength estimate for analysis |
| Updates | After each match | After each match |
| Match weights | Set by FIFA | Set by the site |
| Goal margin | Handled differently | Often scales the change |
| Output | Rank and points | Rating on a chess-like scale |

The exact formulas and weights are different, so the two tables can disagree. A team that wins narrowly in many competitive matches may look better in one and worse in the other.

## What rankings are good for

- **A quick sense of strength.** A gap of many places usually means a real gap in quality.
- **Seeding.** Draws for tournaments use rankings or pots so that top teams do not meet early. The same logic applies to club competitions, as in the [Champions League format](/guides/how-the-new-champions-league-format-works).
- **A prior for a model.** A rating gap converts to expected goals, and the [Poisson step](/guides/poisson-distribution-soccer-goals-explained) turns that into scoreline chances.

## What they cannot tell you

National-team ratings face a particular problem: teams play few matches, often in different continents, so ratings can drift or rest on thin evidence. Friendlies are noisy because squads rotate. Rankings also ignore the selected lineup, so a squad without its best players can be far weaker than its rank suggests. The ideas in the guide on [small samples and form](/guides/small-samples-and-soccer-form-luck-or-skill) apply doubly to international soccer.

## Reading a ranking move sensibly

A team that climbs five places has not necessarily improved by much. Rankings are crowded in the middle, where a small change in points moves a team past several others. The size of the points change matters more than the change in position. If you want to judge whether a move means something, look at the points total and the matches behind it, and ask whether the opponents were strong. The same caution applies to club ratings built from few results, which the guide on [Elo ratings for new teams](/guides/elo-ratings-for-new-teams-why-few-matches-mean-doubt) explains in detail.

## Tournaments and the ranking

Competitive tournaments carry the most weight, so a deep run at a major tournament, such as the [48-team World Cup](/guides/how-the-48-team-world-cup-format-works), can move a team up the table quickly, while a string of friendlies barely shifts it. The qualification route also matters: a team that plays many qualifiers against weak opposition gains little from each win, since the expected result was already a win. That is the self-correcting logic described at the start of this guide.

## How this site rates teams

For clubs, Soccer Games Today computes its own Elo ratings from published results, as described on the [methodology page](/methodology). National teams are not part of the current predictor, so the FIFA ranking and independent Elo tables are mentioned here as background, not as inputs to the site's numbers.

## Sources

- [FIFA, men's world ranking procedure](https://inside.fifa.com/fifa-world-ranking/procedure-men), FIFA. The official description of the points calculation used in the men's ranking.
- [World Football Elo Ratings, "About"](https://www.eloratings.net/about), eloratings.net. The independent Elo method for national teams.
- [FIFA Men's World Ranking, Wikipedia](https://en.wikipedia.org/wiki/FIFA_Men%27s_World_Ranking), Wikipedia. History of the ranking and the 2018 change of method.
