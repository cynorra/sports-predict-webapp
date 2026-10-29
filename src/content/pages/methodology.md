---
title: "Prediction Methodology"
description: "How SkorRadar produces football score predictions: Elo ratings, expected goals, a Poisson score model and how we grade accuracy in public."
updatedAt: 2026-10-29
---

Our predictions are produced by a deliberately simple model that we can explain in full. This page describes each step and its limits.

## Step 1: team strength (Elo)

Each team has an Elo-style rating that rises after good results and falls after bad ones. A home side receives a fixed home-advantage bonus of 65 rating points when we compare two teams. The rating difference is converted into an expected share of the goals in the match.

We calculate the ratings ourselves from real match results: the last few seasons of the major domestic leagues and the Champions League, downloaded from football-data.org. Every club starts at the same value and moves after each game, with bigger goal margins moving it more. Clubs from different leagues are only linked through matches against each other, mostly in European competition, so ratings of clubs with few such games are less reliable. We do not publish a prediction for a club with fewer than ten rated matches.

## Step 2: expected goals

We scale the league-average scoring rate (about 1.35 goals per team per match) by that share, and by each team's attacking and defensive strength relative to the league where those figures are available. The result is an expected goals number for both sides.

## Step 3: scoreline probabilities

Goals are modelled with a Poisson distribution. We calculate the probability of every scoreline from 0-0 to 8-8, add them up to get the chance of a home win, draw and away win, and report the single most likely scoreline.

## What the numbers mean

A 55% home-win probability means the model expects the home side to win about 55 times in 100 identical matches. It does not mean the home side will win this one. The most likely single scoreline is usually only 10-15% likely, because football has many plausible results.

## What the model ignores

The model does not know about last-minute injuries, tactical changes, weather, motivation or referee decisions. Our written analysis covers those factors, but they are not in the numbers.

## Accuracy tracking

The site is new and has not yet published a track record, so we make no claim about how accurate the model is. Once predictions are being made on live fixtures, we will record each one before kickoff and publish the results afterwards, hits and misses alike, without deleting or editing past entries. Until that record exists, treat every number on the site as an estimate from a simple model.

## Fair odds

Where odds are shown, they are "fair odds": one divided by the model probability. They are an expression of the model's view, not betting prices, and we do not promote bookmakers. See our [responsible play statement](/responsible-play).
