# Tauri v2 Architecture — Research Notes

## Overview
StreamerSuite is built on **Tauri v2**, a framework for building lightweight desktop apps using web frontends and a Rust backend. Tauri v2 was released in late 2024 and represents a significant evolution from v1.

## Key Architecture Decisions in This Project

### Frontend Stack
- **React 19** with TypeScript
- **Vite 8** as the bundler/dev server
- **Tailwind CSS v4** for styling (via `@tailwindcss/vite` plugin)
- Path alias `@` mapped to `src/`

### Backend Stack
- **Rust** with Tauri v2 core
- **tokio** async runtime (full features)
- **reqwest** for HTTP requests (rustls-tls, JSON support)
- **tracing** for structured logging
- **tauri-plugin-shell** and **tauri-plugin-dialog** for native integrations

### Project Structure
```
StreamerSuite/
├── src/                  # React frontend
│   ├── apps/             # Sub-applications (modular)
│   │   ├── registry.ts   # App registration system
│   │   ├── alerts-hub/
│   │   ├── chat-confluence/
│   │   ├── notes-commands/
│   │   ├── scene-switcher/
│   │   ├── sound-board/
│   │   ├── statusforge/
│   │   ├── stream-stats/
│   │   └── stream-timer/
│   ├── components/       # Shared UI components
│   ├── hooks/            # React hooks (theme, chat, app state)
│   ├── shell/            # App shell (launcher, topbar, layout)
│   └── types/            # TypeScript type definitions
├── src-tauri/            # Rust backend
│   ├── src/              # Rust source
│   ├── capabilities/     # Tauri capability permissions
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
└── vite.config.ts        # Vite configuration
```

## Tauri v2 Key Concepts

### IPC (Inter-Process Communication)
Tauri v2 uses a command-based IPC pattern:
- **Rust side**: `#[tauri::command]` functions exposed to frontend
- **JS side**: `import { invoke } from '@tauri-apps/api/core'`
- Type safety via `serde` serialization

### Capabilities System
Tauri v2 replaces the old `allowlist`/`denylist` with a **capabilities** system:
- Defined in `src-tauri/capabilities/` as JSON files
- Granular permission control per window/plugin
- Principle of least privilege

### Multi-Window Support
Tauri v2 supports multiple labeled windows defined in `tauri.conf.json`. StreamerSuite currently uses a single `main` window but the architecture could extend to:
- Pop-out chat windows
- Always-on-top timer overlays
- Detached alert previews

### Security CSP
The current CSP in `tauri.conf.json`:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob;
connect-src 'self' ws: wss: https:;
font-src 'self'
```
This allows WebSocket connections (for chat) and HTTPS API calls (for streaming platform APIs).

## Relevant Tauri v2 Plugins for This Project

| Plugin | Purpose | Status in Project |
|--------|---------|-------------------|
| `tauri-plugin-shell` | Open external URLs, manage sidecars | ✅ Listed in Cargo.toml |
| `tauri-plugin-dialog` | Native file/save dialogs | ✅ Listed in Cargo.toml |
| `tauri-plugin-http` | Make HTTP requests from Rust (avoids CORS) | ❌ Not yet added |
| `tauri-plugin-websocket` | Native WebSocket connections | ❌ Not yet added |
| `tauri-plugin-notification` | OS-level notifications | ❌ Not yet added |
| `tauri-plugin-global-shortcut` | Register global hotkeys | ❌ Not yet added |
| `tauri-plugin-clipboard` | Clipboard read/write | ❌ Not yet added |
| `tauri-plugin-fs` | Filesystem access | ❌ Not yet added |
| `tauri-plugin-process` | Spawn/launch external processes | ❌ Not yet added |

## Recommendations

1. **Add `tauri-plugin-http`**: Streaming platform API calls (Twitch, etc.) should go through Rust to avoid CORS issues and keep API secrets server-side.
2. **Add `tauri-plugin-websocket`**: Chat connections (IRC/WebSocket) should be handled in Rust for reliability and to survive frontend re-renders.
3. **Add `tauri-plugin-global-shortcut`**: Streamers need global hotkeys for scene switching, sound board triggers, etc.
4. **Add `tauri-plugin-notification`**: Alert notifications when the app is minimized.
5. **Consider `tauri-plugin-process`**: For launching OBS, Streamlabs, or other streaming tools.

## References
- Tauri v2 Docs: https://v2.tauri.app/
- Tauri Plugins: https://v2.tauri.app/plugin/
- Tauri v2 Migration Guide: https://v2.tauri.app/start/migrate-from-tauri-1/
- Cargo.toml workspace patterns: https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html
