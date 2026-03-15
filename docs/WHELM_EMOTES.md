# Whelm Emote System

This file defines the canonical Whelm emote system for the product. The goal is to treat Whelm as a controlled brand character system, not a loose pile of mascot poses.

## Core Principle

- Use emotes to support action.
- Do not use emotes as filler.
- One emote per surface is usually enough.
- Mobile should stay restrained.
- Keep the core cast frequent and the support cast occasional.

## Canonical Core Cast

These are the only emotes that should appear often across the product:

| Canonical ID | Label | Source File | Primary Use |
| --- | --- | --- | --- |
| `whelm.neutral` | Neutral | `neutral_stand_whelm.riv` | default idle / empty state |
| `whelm.wave` | Wave | `wavinghand_whelm.riv` | greeting / welcome back |
| `whelm.guide` | Guide | `givingrecommendation_whelm.riv` | instruction / coach prompt |
| `whelm.encourage` | Encourage | `pointing_with_encouragement_whelm.riv` | nudge / next action |
| `whelm.timer` | Timer | `showingtimer_whelm.riv` | focus / countdown / work mode |
| `whelm.write` | Write | `writingonclipboard_whelm.riv` | notes / planning / capture |
| `whelm.idea` | Idea | `lightbulbidea_whelm.riv` | suggestion / insight / smart tip |
| `whelm.proud` | Proud | `proud_whelm.riv` | completion / celebration |

## Support Cast

These are situational emotes. They should not compete with the core cast.

| Canonical ID | Label | Source File | Best Use |
| --- | --- | --- | --- |
| `whelm.enter` | Enter | `enteringthrough_door_whelm.riv` | daily entry ritual / entering flow |
| `whelm.ready` | Ready | `fightingstance_whelm.riv` | resolve / challenge / discipline |
| `whelm.heart` | Heart | `handonchest_whelm.riv` | reassurance / reflection |
| `whelm.inspect` | Inspect | `holdingmagnifyingglass_whelm.riv` | search / analysis / review |
| `whelm.books` | Books | `holdingstackofbooks_whelm.riv` | study / knowledge |
| `whelm.checklist` | Checklist | `middleofcheckinglist_whelm.riv` | block progress / task flow |
| `whelm.read` | Read | `readingbook_whelm.riv` | reading / study review |
| `whelm.score` | Score | `showingfullmarksclipboard_whelm.riv` | explicit achievement result |
| `whelm.progress` | Progress | `showingsmarboardgraphs_whelm.riv` | reports / trend review |
| `whelm.sort` | Sort | `sortingthroughcards_whelm.riv` | prioritization / organization |
| `whelm.wave_high` | Wave High | `wavinghandhigher_whelm.riv` | bigger welcome / bigger celebration |

## Product Mapping

Use this as the default surface map:

### Schedule

- Primary: `whelm.neutral`
- Situational: `whelm.enter`, `whelm.encourage`, `whelm.timer`

### Today

- Primary: `whelm.timer`
- Situational: `whelm.ready`, `whelm.encourage`, `whelm.proud`

### Notes

- Primary: `whelm.write`
- Situational: `whelm.idea`, `whelm.read`, `whelm.sort`

### Reports

- Primary: `whelm.progress`
- Situational: `whelm.score`, `whelm.proud`

### Onboarding / Entry

- Primary: `whelm.wave`
- Situational: `whelm.guide`, `whelm.enter`

### Empty States

- Primary: `whelm.neutral`
- Situational: `whelm.wave`, `whelm.heart`

## Usage Rules

### Frequency Rules

- Keep daily frequent use to the core cast.
- Use support emotes for special moments only.
- Do not rotate all 19 randomly. That weakens brand memory.

### Mobile Rules

- Do not let emotes dominate the viewport.
- Avoid giant mascot cards above primary actions.
- On mobile, an emote should usually sit beside or below the main action, not before it.

### Tone Rules

- `neutral`: calm, present, nonintrusive
- `wave`: welcoming, simple, friendly
- `guide`: instructional, helpful, competent
- `encourage`: active, directional, motivating
- `timer`: focused, practical, immediate
- `write`: productive, thoughtful, organized
- `idea`: insightful, smart, strategic
- `proud`: earned celebration, not constant praise

### Prohibited Patterns

- No emote on every section by default.
- No more than one primary emote on a single mobile screen.
- Do not use celebration poses for ordinary taps.
- Do not use `ready` or `proud` as idle states.

## Naming Standards

Going forward:

- Use `whelm.<canonical_name>` as the product id.
- Keep filenames short and semantic.
- Avoid sentence-style export names.
- Avoid typo-heavy asset names in product code.

Recommended future filename pattern:

- `whelm-neutral.riv`
- `whelm-wave.riv`
- `whelm-guide.riv`
- `whelm-timer.riv`

## Source Asset Map

These are the original source files referenced for the current batch:

- `/Users/calebroemhildtsultan/Downloads/batch1riv/enteringthrough_door_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/fightingstance_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/givingrecommendation_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/handonchest_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/holdingmagnifyingglass_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/holdingstackofbooks_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/lightbulbidea_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/middleofcheckinglist_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/neutral_stand_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/pointing_with_encouragement_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/proud_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/readingbook_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/showingfullmarksclipboard_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/showingsmarboardgraphs_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/showingtimer_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/sortingthroughcards_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/wavinghand_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/wavinghandhigher_whelm.riv`
- `/Users/calebroemhildtsultan/Downloads/batch1riv/writingonclipboard_whelm.riv`

## Immediate Implementation Guidance

If these start getting wired into the app:

1. Import from `lib/whelm-emotes.ts` instead of hardcoding names.
2. Start with only the core cast in active UI.
3. Add support emotes only where a screen clearly benefits.
4. Keep the app visually disciplined, especially on mobile.
