# StreamerSuite (WORK IN PROGRESS)

Every tool a streamer needs, in one launcher — chat, alerts, overlays, scene
control, stats, and automatic category switching — running locally on your own
machine, with no account and no subscription.

Tauri v2 + React desktop app.

## What's in it

StreamerSuite is a launcher. Each tool is its own app inside it, grouped by
what it's for, and openable in the main window or popped out into its own.

### Chat

| Tool | What it does |
|---|---|
| **Multi-Chat** | One merged chat view across Twitch, Kick, and Joystick.tv, with link previews, avatars, and combo-collapsed gift and raid events |
| **AI Co-Host** | A persona-driven AI co-host powered by a free open model. **Preview — not wired up to respond yet** |
| **Chatbot** | Custom chat commands across Twitch, Kick, Joystick.tv, and Streamer.bot. **Preview — command execution isn't wired up yet** |

### Tools

| Tool | What it does |
|---|---|
| **StatusForge** | Game detection with automatic Twitch/Kick category switching, a game library with cover art, and overlay widgets |
| **Stream Manager** | Set title, category, and tags on Twitch and Kick, and run your pre-stream checklist |
| **Scene Switcher** | Control Meld Studio scenes, audio tracks, and streaming remotely |
| **Stream Timer** | Stopwatch and countdown for stream sessions, bindable to an overlay |

### Alerts

| Tool | What it does |
|---|---|
| **Alerts & Events** | Live follows, subs, raids, cheers, and tips across Twitch, Kick, and Joystick.tv |

### Media

| Tool | What it does |
|---|---|
| **Overlay Editor** | Build browser-source overlays on a drag-and-drop canvas, live-bound to your stream data |
| **Overlay Library** | Browse every overlay and copy its browser-source URL |
| **Sound Board** | Play your own sound clips with a click or a hotkey |

### Utilities

| Tool | What it does |
|---|---|
| **Stream Stats** | Live viewer counts, uptime, follower tracking, and platform breakdowns |
| **Notes & Commands** | Stream notes and a chat command reference |

## Requirements

- [Node.js](https://nodejs.org) 20 or newer and the
  [Rust toolchain](https://rustup.rs), plus your platform's
  [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/).
- Windows 10/11 is the primary, tested target — that's what the release
  workflow builds. macOS and Linux aren't regularly exercised.

Individual tools have their own requirements — Meld Studio for Scene Switcher,
Twitch application credentials for Alerts & Events, and so on. Each vendored
tool's own repo documents its setup; see the repo map below.

## Running it

```sh
npm install
npm run tauri dev
```

`npm run tauri build` produces a release build. `Config.json.template` shows
the shape of the runtime config file.

## How this repo is organised

| Path | What's in it |
|---|---|
| `src/shell/` | The launcher itself — app grid, categories, search, top bar, and pop-out windows |
| `src/apps/` | One directory per tool. Most are vendored from their own repos (see below); `registry.ts` is how each one registers itself with the launcher |
| `src/design-system/` | The shared UI kit — tokens and core components — that every tool builds against |
| `src/settings/` | Shared settings context used across tools |
| `src-tauri/src/` | The Rust backend: platform auth, the local widget/OAuth server, chat, alerts, overlays, and game metadata |
| `widgets/`, `public/` | Built-in overlay files and static assets |
| `Documentation/` | Research notes and technical references behind the implementation |
| `scripts/sync-vendored-tools.py` | Pulls each vendored tool's integration branch into place |
| `Icons/` | Platform and brand marks used across the UI |

## Vendored tools

Most apps under `src/apps/` are developed as standalone Tauri apps in their own
repos and vendored in here, adapted to plug into StreamerSuite's shared
theme/settings and shared Rust backend.

| Tool | Repo |
|---|---|
| StatusForge | [`BearddOddity/StatusForge.io`](https://github.com/BearddOddity/StatusForge.io) |
| Multi-Chat | [`BearddOddity/multichat`](https://github.com/BearddOddity/multichat) |
| Alerts & Events | [`BearddOddity/alerts-hub`](https://github.com/BearddOddity/alerts-hub) |
| Overlay Editor | [`BearddOddity/overlay-editor`](https://github.com/BearddOddity/overlay-editor) |
| Overlay Library | [`BearddOddity/overlay-library`](https://github.com/BearddOddity/overlay-library) |
| Stream Manager | [`BearddOddity/stream-manager`](https://github.com/BearddOddity/stream-manager) |
| Stream Stats | [`BearddOddity/stream-stats`](https://github.com/BearddOddity/stream-stats) |
| Scene Switcher | [`BearddOddity/scene-switcher`](https://github.com/BearddOddity/scene-switcher) |
| Sound Board | [`BearddOddity/sound-board`](https://github.com/BearddOddity/sound-board) |
| Stream Timer | [`BearddOddity/stream-timer`](https://github.com/BearddOddity/stream-timer) |
| Notes & Commands | [`BearddOddity/notes-commands`](https://github.com/BearddOddity/notes-commands) |

**[`VENDORING.md`](VENDORING.md) is the authority on how this works** — the
two-branch policy each tool repo follows, the full path-by-path repo map, and
how to run the sync script. The short version: a tool's `main` branch is the
standalone product and StreamerSuite must never modify it; its
`streamersuite-integration` branch is what gets copied in here.

AI Co-Host, Chatbot, and the launcher shell itself are StreamerSuite-native and
have no separate repo.

## Status

StreamerSuite is pre-1.0 and in active development, built and maintained solo.
Multi-Chat, StatusForge, Alerts & Events, and the overlay tools are the most
complete; AI Co-Host and Chatbot are previews that don't do their main job yet,
and Notes & Commands doesn't persist anything. Each tool's own README is
specific about where it stands.

## Privacy

StreamerSuite runs on your machine. It talks to Twitch, Kick, and Joystick.tv
only with the accounts you've connected, and to game metadata providers only to
look up the game you're playing. There's no StreamerSuite account, no
telemetry, and no server of mine in the middle.
