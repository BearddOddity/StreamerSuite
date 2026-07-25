# BearddOddity Design System — tokens & full component library

Pulled from the Claude Design project at
https://claude.ai/design/p/7269176f-449a-43b0-9f64-2e9847fda49e
("My Design preference"). Originally scoped to just the shared tokens and
`components/core/`; now covers the project's full 40-component library —
every category (`core`, `data`, `disclosure`, `feedback`, `forms`, `layout`,
`media`, `navigation`, `overlay`) is here, converted to typed `.tsx` matching
this repo's convention.

## What's here

- `tokens/*.css` — colors, typography, spacing/radii, effects (blur/shadow/glow),
  and the `bd-*` component utility classes. `styles.css` is the `@import`
  manifest. Component classes for everything below (`.bd-modal-*`,
  `.bd-table`, `.bd-tabs-*`, `.bd-accordion-*`, `.bd-alert-*`, `.bd-empty-*`,
  `.bd-skeleton`, `.bd-checkbox`/`.bd-radio`/`.bd-switch`, `.bd-container`/
  `.bd-header-*`/`.bd-hero-*`/`.bd-footer-*`, `.bd-breadcrumbs`/`.bd-crumb-*`,
  `.bd-pagination`/`.bd-page-*`, `.bd-drawer-*`, `.bd-tooltip*`, `.bd-avatar*`)
  live in `tokens/components.css` — authored to match the same token
  vocabulary as the original set (glass surfaces, the purple accent, the
  established shadow/radius/spacing scale), since the source project's own
  full stylesheet wasn't available when these were added, only its React
  component logic.
- `components/core/` — `Button`, `Card`, `Badge`, `Chip`, `StatusDot`,
  `SectionHead`, `Divider`, `StatCard`, `PricingCard`, `Avatar`, `AvatarGroup`.
- `components/data/` — `Table`.
- `components/disclosure/` — `Accordion`, `Tabs`.
- `components/feedback/` — `Alert`, `EmptyState`, `ProgressBar`, `Skeleton`,
  `Toast`, `ToastManager` (+ the imperative `bdToast.push()` API).
- `components/forms/` — `Select`, `Input`, `Checkbox`, `RadioGroup`, `Switch`,
  `RangeSlider`, `FieldSection`.
- `components/layout/` — `Container`, `Header`, `Hero`, `Footer` (web/marketing
  page structure).
- `components/media/` — `CoverImage`.
- `components/navigation/` — `Breadcrumbs`, `NavItem`, `Pagination`, `Sidebar`,
  `Toolbar`.
- `components/overlay/` — `Modal`, `Drawer`, `Tooltip`, `Menu`.

Each category has its own `index.ts` barrel — import from
`design-system/components/<category>`.

## Adoption across the app

Most individual app screens (`sound-board`, `stream-manager`, `ai-cohost`,
`chatbot`, `stream-timer`, `scene-switcher`, `alerts-hub`, `notes-commands`,
`overlay-editor`, `overlay-library`, `stream-stats`) already pull `Button`/
`Card`/`Badge`/etc. from `components/core`. The two vendored apps
(`multi-chat`, `statusforge`) don't — they carry their own established UI
from their source repos. The outer app shell (`TopBar`, the app launcher,
`MainSettingsPage`) doesn't use this system yet either; that's still native
styling. Wiring those, and pulling individual apps' remaining hand-rolled
markup (modals, tables, forms) over to the now-available primitives, is
follow-up work, not something this pass did.

These tokens describe the same dark-glassmorphism/Twitch-purple look
StreamerSuite's `src/index.css` already implements natively (accent
`#9146ff`, canvas `#050505`, blurred black-alpha cards) — the design
project's own readme says as much ("lifted from their real CSS, not
reconstructed from memory").

## Not included

The design project also has full page templates (`templates/landing-page`,
`templates/app-dashboard`, `templates/docs-page`, `templates/login`,
`templates/error-404`) and three complete `ui_kits/` screen recreations
(StatusForge, StreamerSuite, PanelForge) — none of that was pulled in. Ask
for a specific piece by name to bring in more.
