# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

StreamerSuite is a Tauri (Rust + React/TS) desktop app that bundles several
independent streaming-utility "apps" (chat aggregation, OBS scene switching,
sound board, alerts, etc.) behind a single launcher shell. One of the bundled
apps, `statusforge`, embeds the same rich-presence/game-detection feature set
as the separate StatusForge.io repo (they share the `forge-detection` Rust
crate and duplicate `spark_protocol.rs` — keep those in sync across repos
when touched here).

`Documentation/` contains research notes for each subsystem — read the
relevant doc before touching that area:
- `01-tauri-v2-architecture.md`, `02-streaming-platform-apis.md` (Twitch/
  YouTube/Kick/Discord), `03-oauth-pkce-auth.md`, `04-obs-scene-switching.md`
  (obs-websocket v5), `05-websocket-chat-integration.md`, `06-plugin-registry-
  pattern.md`, `07-sound-board-audio.md`, `08-stream-overlays-alerts.md`.

## Common commands

```
npm run dev       # vite dev server
npm run build      # vite build
npm run preview
npm run tauri dev   # full desktop app
npm run tauri build
```

No test suite or CI workflow exists yet in this repo (unlike StatusForge.io,
which has both) — there's no `npm test` script and no `.github/workflows/`.

Rust: `src-tauri` is its own crate (package name `chatconfluence`, binary/lib
`chatconfluence_lib` — a holdover from the original single-app name; the repo
is StreamerSuite but the Cargo package wasn't renamed). Build via `npm run
tauri dev`/`build` rather than raw `cargo` since resources are wired through
`tauri.conf.json`.

## Architecture

### App registry / shell pattern (`src/shell/`, `src/apps/`)
`AppShell.tsx` is the top-level shell: it renders either the `Launcher` (grid
of available apps) or whichever sub-app is active, plus a `TopBar` and the
shared settings modal. Sub-apps don't import each other or the shell directly
— each one self-registers with the registry:

```ts
// src/apps/registry.ts
registerApp({ id, name, icon, description, category, component, featured? })
```

`src/apps/index.ts` just imports every app module (for its registration side
effect); `getApps()`/`getApp(id)`/`getAppsByCategory()` are how the shell
reads the registry back. To add a new sub-app: create `src/apps/<name>/`,
call `registerApp` in its entry file, and add the import to
`src/apps/index.ts`. This is a **static/hardcoded registry** (see
`Documentation/06-plugin-registry-pattern.md` for the planned dynamic-loading
evolution) — nothing is loaded at runtime.

Current sub-apps: `alerts-hub`, `chat-confluence`, `notes-commands`,
`scene-switcher`, `sound-board`, `statusforge`, `stream-stats`,
`stream-timer` — each is a self-contained directory under `src/apps/`
(some, like `chat-confluence` and `statusforge`, have their own nested
`types/`, `components/`, `hooks/` rather than reusing the top-level ones).

### Settings (`src/settings/`)
`SharedSettingsProvider` (wrapped around the whole app in `App.tsx`) holds
config shared across sub-apps (e.g. platform API keys), separate from any
per-app local state. `src/components/settings/MainSettingsPage.tsx` is the
tabbed settings UI reachable via the shell's gear icon.

### Chat (`src/hooks/useChat.ts`, `src/components/chat/`)
Multi-platform chat handling per `Documentation/05-websocket-chat-integration.md`
— chat-confluence aggregates multiple platform chat connections into one feed.

### `settings-backup/`
Contains an older/parallel copy of settings components (`ApiKeysTab.tsx`,
`MainSettingsPage.tsx`, `SettingsModal.tsx`, `ThemeContext.tsx`, `ThemeTab.tsx`)
— check whether this is live reference material or dead code before assuming
either the `src/settings/` versions or these are canonical.

### Icons
Platform brand icons (Twitch, Kick, JoystickTV, Streamer.bot) live in both
`Icons/` (repo root) and `src/Icons/` (bundled copy actually imported by the
app) — update both if replacing an icon asset.
