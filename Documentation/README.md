# StreamerSuite — Documentation

Research notes and technical references for the StreamerSuite project.

## Documents

| # | File | Topic |
|---|------|-------|
| 01 | [`01-tauri-v2-architecture.md`](./01-tauri-v2-architecture.md) | Tauri v2 architecture, project structure, recommended plugins |
| 02 | [`02-streaming-platform-apis.md`](./02-streaming-platform-apis.md) | Twitch, YouTube, Kick, Discord API references |
| 03 | [`03-oauth-pkce-auth.md`](./03-oauth-pkce-auth.md) | OAuth 2.0 / PKCE auth flows for all supported platforms |
| 04 | [`04-obs-scene-switching.md`](./04-obs-scene-switching.md) | obs-websocket protocol, scene/source control |
| 05 | [`05-websocket-chat-integration.md`](./05-websocket-chat-integration.md) | Multi-platform chat protocols, unified message schema |
| 06 | [`06-plugin-registry-pattern.md`](./06-plugin-registry-pattern.md) | App registry pattern, shell architecture, state management |
| 07 | [`07-sound-board-audio.md`](./07-sound-board-audio.md) | Audio playback, routing, hotkeys, file management |
| 08 | [`08-stream-overlays-alerts.md`](./08-stream-overlays-alerts.md) | Alert types, overlay architecture, browser source approach |

## Key Platforms

- **Twitch** — EventSub (WebSocket), IRC Chat, Helix API
- **YouTube** — Live Streaming API, Live Chat polling
- **Kick** — Public API, Pusher WebSocket chat
- **Discord** — Gateway WebSocket, REST API
- **OBS Studio** — obs-websocket v5 protocol
