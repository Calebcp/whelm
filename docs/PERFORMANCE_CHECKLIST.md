# Performance Checklist

Use this before shipping UI-heavy changes in Whelm.

## Shell
- Keep new tab, modal, and sheet state out of [`app/page.tsx`](/Users/calebroemhildtsultan/Documents/MainWhelm/app/page.tsx) unless multiple surfaces truly depend on it.
- Prefer container boundaries like `HomeTodayContainer`, `HomeScheduleContainer`, `HomeNotesContainer`, and `HomeOverlayHost` over inline prop mountains.
- Memoize large prop contracts passed from the page shell instead of rebuilding them inline.

## Render Boundaries
- Split large tab surfaces into memoized panels when they contain distinct interaction lanes.
- Do not put live editor, timer, or timeline state in the same render boundary as static lists if they can be separated.
- Avoid fake `memo` wins: if a parent recreates object literals or handler closures every render, fix the contract first.

## Derived Data
- Index and group once for repeated lookups instead of filtering arrays during render.
- Keep heavy date/session/report derivation inside dedicated hooks with stable inputs.
- Re-check dependency arrays when adding new memoized view models.

## Motion And Paint
- Avoid per-item `motion` wrappers in long lists unless they are essential.
- Prefer reducing shared blur and shadow tokens before adding more glass or glow.
- Treat `backdrop-filter`, large blurs, and layered gradients as expensive by default, especially on mobile.

## Overlays
- Add new overlays through [`components/HomeOverlayHost.tsx`](/Users/calebroemhildtsultan/Documents/MainWhelm/components/HomeOverlayHost.tsx) instead of mounting them inline in the page shell.
- Keep overlay-local state inside the overlay or a dedicated host contract whenever possible.

## Verification
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Manually check tab switch, schedule interactions, notes editing, timer controls, and overlay open/close behavior after structural changes.
