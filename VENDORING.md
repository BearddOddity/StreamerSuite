# Vendored tools

StreamerSuite is a launcher: most of the apps under `src/apps/` are not
written against StreamerSuite directly — each one is developed as its own
standalone Tauri app in its own repo, and a copy of that app's code is
vendored into StreamerSuite, adapted to plug into StreamerSuite's shared
theme/settings and (where applicable) shared Rust backend.

## Branch policy

Every vendored-tool repo carries two branches:

- **`main`** — the standalone product. Only standalone-focused work lands
  here (bug fixes, new features for people running the tool on its own).
  Never push StreamerSuite-specific adaptations to this branch — that risks
  breaking the tool for people using it outside StreamerSuite.
- **`streamersuite-integration`** — the StreamerSuite-adapted version:
  import paths rewired onto StreamerSuite's shared settings/theme context,
  and (for tools that need it) hooked into StreamerSuite's shared Rust
  modules instead of carrying their own copy. This branch is what gets
  copied into StreamerSuite's `src/apps/<tool>/` (and `src-tauri/src/` for
  any Rust). It's created off `main` and periodically brought forward from
  `main` so standalone improvements flow into the integrated version — never
  the other way around.

There is no automated sync script yet — bringing a repo's
`streamersuite-integration` branch into StreamerSuite is a manual, reviewed
copy today. Automating that is future work.

## Repo map

| StreamerSuite path | Canonical repo | Notes |
|---|---|---|
| `src/apps/statusforge/`, `src-tauri/src/{auth,blipy_protocol,config,feedback,hub,metadata,metadata_signing,pusher,server}.rs` | [`BearddOddity/StatusForge.io`](https://github.com/BearddOddity/StatusForge.io) | Full standalone product. StreamerSuite's `server.rs`/`lib.rs` extend the shared copy with routes/commands other tools (Alerts & Events, Overlay Library) also use. |
| `public/multichat/`, `src-tauri/src/multichat.rs` | [`BearddOddity/multichat`](https://github.com/BearddOddity/multichat) | Canonical repo ships a single inline-`<script>` `index.html`; StreamerSuite's CSP forbids inline scripts, so the vendored copy extracts that script into `multichat.js` loaded via `<script src>`. |
| `src/apps/notes-commands/` | [`BearddOddity/notes-commands`](https://github.com/BearddOddity/notes-commands) | Standalone + self-sufficient — no shared Rust. |
| `src/apps/stream-timer/` | [`BearddOddity/stream-timer`](https://github.com/BearddOddity/stream-timer) | Standalone + self-sufficient — no shared Rust. |
| `src/apps/sound-board/` | [`BearddOddity/sound-board`](https://github.com/BearddOddity/sound-board) | Standalone + self-sufficient — no shared Rust. |
| `src/apps/scene-switcher/` | [`BearddOddity/scene-switcher`](https://github.com/BearddOddity/scene-switcher) | Standalone + self-sufficient — no shared Rust. |
| `src/apps/stream-manager/`, `src-tauri/src/stream_manager.rs` | [`BearddOddity/stream-manager`](https://github.com/BearddOddity/stream-manager) | Standalone build is self-sufficient; integration branch hooks into StreamerSuite's shared modules. |
| `src/apps/stream-stats/` | [`BearddOddity/stream-stats`](https://github.com/BearddOddity/stream-stats) | Standalone build carries its own minimal Twitch-stats fetch (duplicated from Alerts & Events); the integration branch instead calls the shared `alerts::twitch_stream_stats`. |
| `src/apps/alerts-hub/`, `src-tauri/src/alerts.rs` | [`BearddOddity/alerts-hub`](https://github.com/BearddOddity/alerts-hub) | Owns `twitch_stream_stats`, also consumed by Stream Stats. |
| `src/apps/overlay-library/`, `src-tauri/src/overlay_manager.rs` | [`BearddOddity/overlay-library`](https://github.com/BearddOddity/overlay-library) | Standalone build runs its own lightweight overlay server; integration branch uses StreamerSuite's shared `server.rs` custom-overlay routes instead. |

Everything else under `src/apps/` (currently just the settings/launcher shell
itself) is StreamerSuite-native and has no separate repo.
