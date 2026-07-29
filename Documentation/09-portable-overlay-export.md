# Portable Overlay Export — Design Notes

## Problem

Today, every overlay's live-bound fields (viewer/follower counts, alerts, chat,
sound-on-event, value-driven visibility, etc.) work by opening a WebSocket
back to `ws://127.0.0.1:53735/...` — StreamerSuite's own local server, which
only exists while the app is running on that machine and holds the
broadcaster's own Twitch/Kick/etc. credentials (`AppConfig.broadcaster`).

If you hand someone who doesn't have StreamerSuite installed just the
overlay's `.html` file (or its URL), none of that works: `getOverlayToken()`
finds no token, live-bound fields fall back to design-time placeholder
behavior (sample data, alert-triggered elements auto-showing once, etc.) —
it *looks* right but never reflects their real stream. Static (non-bound)
elements — text, colors, shapes, embedded images/fonts/sounds — are already
fully self-contained as `data:` URIs and work forever with no server.

Goal: let a StreamerSuite user design an overlay and hand it to someone
who has never installed StreamerSuite, with that overlay working 100% for
*their own* stream, using *their own* credentials — without asking that
recipient to install the full app.

This is a personal-project-scale feature (no dedicated support team), so
every decision below leans toward minimizing ongoing maintenance burden
over maximizing polish.

## Why "just add a credentials file" doesn't work

A static settings file alone can't make authenticated API calls or hold a
live connection open — something has to actually *run* to do that. So the
real design question was never "what file format," it was "what process
runs on the recipient's machine, and how do we avoid asking them to
install something scary or unfamiliar to do it."

## Decided architecture

### 1. Export Wizard (inside StreamerSuite)

A multi-step flow the *creator* (StreamerSuite user) runs when they want to
hand an overlay to someone else:

1. **Detected sources review** — the wizard walks the saved overlay's
   elements (bound `title`/`subtitle` sources, `alertTrigger.kinds`,
   `valueCondition.source`, etc.) and pre-checks which platforms/live
   sources are actually referenced. Editable, not just a dumb platform
   checklist — this is what makes the export minimal (a Kick-only overlay
   never asks the recipient for a Twitch credential).
2. **Customization scope** — creator picks which fields (colors, fonts,
   text) stay editable for the recipient vs. locked as designed, so
   recipients get some personality/control without being able to break the
   layout.
3. **Review/summary**
4. **Export** — generates the package (see below).

**Excluded from portable export:** StatusForge-driven templates (Now
Playing Card, Game Logo) — they depend on StatusForge's local
game-detection, which has no cloud-credential equivalent a recipient could
"connect." Recipients who want those templates need the full app.

### 2. Exported package

A **folder, not an installed app** — no installer, no Start Menu entry, no
uninstaller. Contains:

- The overlay's HTML/assets
- A settings manifest (JSON — see schema below)
- **Both** platform helper scripts (Windows PowerShell + Mac Python) — the
  export can't know which OS the recipient is on, so it bundles both;
  they run whichever matches their machine.

Every export bundles its own copy of the helper. On launch, it checks
whether a helper is already running on the recipient's machine (well-known
local port) and self-registers with it instead of starting a redundant
second process — see "Shared helper" below.

### 3. The helper

Small background process, **no GUI, no installed-app footprint**. Binds
**loopback-only** (`127.0.0.1`) — same proven pattern as StreamerSuite's own
`server.rs` ("The server only ever binds loopback"), which means it does
**not** trigger OS firewall prompts (loopback traffic never crosses the
boundary Windows/macOS firewalls guard). The only outbound network calls it
makes are the recipient's own credentialed calls to Twitch/Kick.

**Manually launched each time** before streaming — no auto-start/login
item, to avoid feeling like an installed background service. Tradeoff:
if they forget, the overlay shows a **visible "disconnected" chip badge on
the overlay itself** (not hidden in a settings page only) so it's caught
before going live, not discovered mid-stream.

**Hosts a real local settings page** (HTML, not a hand-edited file) —
this is the actual credentials/settings interface:
- Per-platform "Connect" flow using the **recipient's own credentials**
  (not a shared OAuth app tied to the exporter — avoids one exporter's app
  registration/rate-limit/ToS status affecting every recipient)
- Color/font pickers for whatever the creator left customizable
- A "Send Test Alert" button (mirrors the one already in Overlay Library)
- A configurable port field, tucked in an out-of-the-way "Advanced"
  section — most recipients never touch it
- Live customization is served to the overlay at runtime, not baked into
  a static file — same live-update pattern the overlay already uses for
  viewer counts etc.

### 4. Shared helper (one per recipient, not one per overlay)

If a recipient has been given multiple overlays over time (from one or
several export events), everything converges into **exactly one** running
helper on their machine. Each new overlay opened registers itself with
whichever helper is already running, reusing already-connected credentials
(no re-entering a Kick token for the third overlay that also needs it) and
only prompting for whatever's newly required. Each registered overlay is
served at its own path off the one shared port
(`127.0.0.1:<port>/overlay/<id>/`).

This was chosen over "one helper per overlay" specifically for the
returning-recipient case — cost is paid once on the build/maintenance
side (the helper's manifest format has to stay compatible across
overlays exported at different times — see Versioning below), not
repeatedly by every recipient re-entering the same credential.

### 5. Windows vs. Mac implementation

No single scripting runtime is reliably preinstalled on both platforms
today (Java hasn't shipped with either OS in over a decade; macOS dropped
its bundled Python as of Monterey/12.3 in 2022). Electron apps like Discord
bundle their own *private* Node.js internally — not reachable by anything
else, so "they probably have Discord" doesn't help.

- **Windows**: PowerShell + .NET Framework, both reliably present on every
  Windows 10/11 machine (reinforced further by gaming — many games/Steam
  itself require .NET). Zero extra install for the recipient. No
  SmartScreen warning, since PowerShell itself is signed by Microsoft and
  we're just handing it a script, not shipping our own executable.
- **Mac**: no built-in equivalent exists anymore. Recipient does a
  one-time official **Python** install from python.org (notarized
  installer, no Gatekeeper warning). Python over Node.js specifically for
  the "must be understood as safe" requirement — Python has far higher
  name recognition and zero negative association with non-technical
  users; Node.js reads as a "developer tool" name most non-programmers
  have never heard of.
- After that one-time interpreter install, we're distributing a **plain
  script file**, not a compiled binary — Gatekeeper/SmartScreen don't flag
  scripts run through an already-trusted interpreter the way they flag a
  standalone unsigned executable. This closes out the binary-signing/trust
  problem entirely, on both platforms, without ever needing to buy a
  code-signing certificate.

This does mean maintaining two separate helper implementations (a
PowerShell/.NET one and a Python one) rather than one shared codebase —
accepted tradeoff for avoiding both the trust-warning problem and asking
recipients to install something unfamiliar.

## Manifest schema (settings file)

Plain JSON — not JSONC/commented. Both target runtimes (PowerShell's
`ConvertFrom-Json`, Python's `json` module) parse plain JSON with zero
extra dependencies, which matters since we're deliberately avoiding
anything that requires installing libraries. The "pretty and readable"
goal from earlier discussion is now fully satisfied by the **settings
page** (the human-facing UI) — nobody is expected to hand-edit this file,
so it just needs to be clean and logically grouped, not decorated.

Fields (draft, not final):
- `manifestVersion` (int)
- `overlayId` (string) — stable identifier for this specific overlay,
  used in its served path under the shared helper
- `platformsNeeded` (array) — from the wizard's detection step
- `customizable` (object) — which fields the creator left editable, and
  their current default values (color, font, text) as the recipient's
  starting point
- `canvasWidth` / `canvasHeight` (int) — for OBS Browser Source setup

## Versioning strategy

Simple integer `manifestVersion`. If the running helper encounters a
manifest version it doesn't recognize (newer than what it supports), it
shows a clear "this overlay needs an updated helper" message — never
silently guesses or fails quietly. Schema changes should add new
**optional** fields rather than restructuring existing ones, so version
bumps stay rare. Full backward-compatibility handling for every past
version isn't being built — disproportionate for a personal-project-scale
feature; keep the schema conservative instead.

## Support philosophy

Recommended (not yet finalized — this is a policy call, not a technical
one): the settings page states plainly that the overlay was "set up for
you by [creator], but troubleshooting isn't guaranteed" — sets
expectations up front rather than implicitly signing up for indefinite
support to strangers.

## Open / explicitly deferred

- Exact wizard screen copy/layout and settings-page screen copy/layout —
  only the rough flow is decided (see sections 1 and 3 above)
- Whether/how port auto-selection avoids collisions if the recipient
  somehow runs two independent helpers at once (shouldn't happen given
  the single-shared-helper design, but worth a defensive check)
- Final manifest field list (draft above, not implemented or reviewed
  against real export scenarios yet)

## Status

**Design only — nothing in this document has been implemented.** This
file exists to preserve the decisions made during a long design
conversation so they don't have to be re-derived. Implementation has not
started.
