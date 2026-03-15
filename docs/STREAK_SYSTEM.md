# Streak System

This file defines the canonical streak reward ladder and the intended direction for streak qualification in Whelm.

## Current State

Current code in [lib/streak.ts](/Users/calebroemhildtsultan/Documents/MainWhelm/lib/streak.ts) counts a streak day if there is any completed session on that date.

That means the current streak is:

- simple
- easy to compute
- easy to understand
- too loose for the ritual/discipline identity Whelm wants

## Bandana Reward Ladder

Whelm uses seven streak bandana tiers.

| Tier ID | Color | Streak Range | Source Asset |
| --- | --- | --- | --- |
| `tier1_yellow` | Yellow | `1 day` | `yellow_bandana_streak.riv` |
| `tier2_red` | Red | `2-4 days` | `red_bandana_streak_.riv` |
| `tier3_green` | Green | `5-9 days` | `green_bandana_streak_.riv` |
| `tier4_purple` | Purple | `10-19 days` | `purple_bandana_streak__.riv` |
| `tier5_blue` | Blue | `20-49 days` | `blue_bandana_streak_.riv` |
| `tier6_black` | Black | `50-99 days` | `black_bandana_streak.riv` |
| `tier7_white` | White | `100+ days` | `white_bandana_streak.riv` |

## Display Language

Use direct tier names in the UI:

- `Yellow Bandana`
- `Red Bandana`
- `Green Bandana`
- `Purple Bandana`
- `Blue Bandana`
- `Black Bandana`
- `White Bandana`

Do not add invented rank titles on top of the colors. The color progression already carries enough meaning.

## Animation Guidance

These bandanas are intended to float gently in streak boxes.

- Keep a single looping animation clip per `.riv`.
- If the source loop is about `1 second`, play it at roughly `0.33x` in the app.
- Target visual feel:
  - calm
  - buoyant
  - not bouncy
  - not attention-hogging

## Proposed Streak Qualification Direction

Proposed future rule from product direction:

- a streak day should require:
  - at least `1` completed foundational block
  - and at least `30 minutes` of focus time

This is directionally stronger than the current rule because it makes streaks mean something.

## Product Judgment On The Proposed Rule

This proposed rule is strong, but it must be handled carefully.

### What is good about it

- It aligns with Whelm's ritual identity.
- It makes the streak harder to fake.
- It ties streaks to both planning and actual execution.
- It makes bandana advancement feel earned instead of decorative.

### What is risky about it

- It is stricter than most streak systems.
- New users may lose streaks quickly and feel punished.
- If foundational blocks are not clearly explained, the streak rule will feel arbitrary.
- If the app has any friction in block completion, users will blame the streak system.

## Recommended Final Rule

Recommended version:

- a streak day counts when:
  - at least `1` foundational block is completed
  - and at least `30` total focused minutes are logged that day

### Why this version is good

- It is strict enough to matter.
- It is simple enough to explain in one sentence.
- It avoids analytics theater.
- It supports the "claim today before it claims you" philosophy.

## Required UX If This Rule Ships

If Whelm adopts this streak rule, the UI must always show:

- whether today is currently protected or not
- how many focus minutes remain until protection
- whether a foundational block has been completed yet
- a simple "today protected" or "streak at risk" state

Without that clarity, the rule will feel unfair.

## Recommended Future UI Language

- `Streak protected`
- `At risk`
- `1 foundational block completed`
- `18 minutes left to protect today`
- `Today is not protected yet`

Avoid:

- vague score language
- hidden qualification logic
- passive analytics phrasing

## Implementation Direction

Before changing the live streak logic:

1. Track whether a completed block was foundational.
2. Compute daily focus minutes reliably.
3. Add a visible daily protection indicator.
4. Only then replace the current loose session-based streak rule.
