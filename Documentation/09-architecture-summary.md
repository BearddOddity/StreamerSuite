# StreamerSuite — Architecture Summary

Living reference document for high-level project decisions. Update this file as decisions change; don't let it drift from reality.

_Last updated: 2026-07-08_

## Project Overview

- **Mission**: Unified streaming tool consolidating chat, overlays, analytics, and community management across 5 platforms (Twitch, Kick, YouTube, JoystickTV, Rumble).
- **Timeline**: Alpha in < 1 week, Beta in 1 month.
- **Model**: Donation-based, open-source at launch.
- **Status**: Early MVP / proof of concept, private repo until launch.
- **Build**: Solo, open to contributors post-launch.

## MVP Scope

- **First tool**: Chat Management — message aggregation, moderation, filtering, auto-responses across all 5 platforms.
- **Second tool**: Status Forge — game detection + rich presence + metadata casting. Extract as a standalone Rust crate.

## Tech Stack

- **Backend**: Rust (modular crates architecture)
- **Frontend**: React
- **Desktop framework**: Tauri
- **Database**: Hybrid — shared config SQLite + tool-specific SQLite databases
- **Editor**: VS Code
- **Resource efficiency**: Lightweight; avoid 200+ MB bloat

## Architecture

- **Structure**: Modular — each tool as its own service/crate
- **Inter-service communication**: Shared Rust crates (in-process for MVP)
- **Frontend-backend communication**: Tauri invoke commands (type-safe, built-in)
- **Message aggregation**: Hybrid — WebSocket primary, API polling fallback
- **Message storage**: Local SQLite database
- **Distribution**: Desktop app (Tauri)

## Platform Integration

- **Primary confidence**: Twitch, Kick
- **OAuth2 authentication**: Hybrid — system browser + local localhost callback
- **Credential storage**: OS keyring for tokens, SQLite for non-sensitive config
- **MCP servers**: Joystick/Kick/Twitch MCPs can be expanded to action-taking (currently research/docs only)

## Database Strategy

- **Shared config DB**: Platform credentials, OAuth tokens (keyring), user settings, app config
- **Tool-specific DBs**: Chat messages (Chat tool), game/presence data (Status Forge), etc.

## Platform Targets

| Platform | Confidence |
|---|---|
| Twitch | High |
| Kick | High |
| YouTube | Future |
| JoystickTV | Future |
| Rumble | Future |
