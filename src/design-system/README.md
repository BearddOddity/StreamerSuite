# BearddOddity Design System — tokens & core primitives

Pulled from the Claude Design project at
https://claude.ai/design/p/7269176f-449a-43b0-9f64-2e9847fda49e
("My Design preference"), scoped to just the shared design tokens and the
`components/core/` primitives. Not wired into the app yet — `styles.css`
isn't imported anywhere, and none of the existing screens use these
components. This is a foundation to build on, not a redesign.

## What's here

- `tokens/*.css` — colors, typography, spacing/radii, effects (blur/shadow/glow),
  and the `bd-*` component utility classes, verbatim from the source project.
  `styles.css` is the `@import` manifest.
- `components/core/*.tsx` — `Button`, `Card`, `Badge`, `Chip`, `StatusDot`,
  `SectionHead`, `Divider`, `StatCard`, `PricingCard`. Same markup/behavior as
  the source `.jsx` files, converted to typed `.tsx` (this repo's convention —
  everything else here is TypeScript) using the source's own `.d.ts` contracts.

## Why nothing changed yet

These tokens describe the same dark-glassmorphism/Twitch-purple look
StreamerSuite's `src/index.css` already implements natively (accent
`#9146ff`, canvas `#050505`, blurred black-alpha cards) — the design
project's own readme says as much ("lifted from their real CSS, not
reconstructed from memory"). Rather than run two parallel styling systems
side by side, this was brought in as a reference/foundation layer only.
Wiring `styles.css` into `main.tsx` or swapping a screen's markup over to
these primitives is a deliberate follow-up, not something this pass did.

## Not included

The design project also has full page templates, three complete `ui_kits/`
screen recreations, a proposed `redesigns/StreamerSuite Redesign.html`, and
`components/{forms,feedback,navigation,media,layout,overlay,disclosure,data}`
— none of that was pulled in. Ask for a specific piece by name to bring in
more.
