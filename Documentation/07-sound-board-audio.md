# Sound Board & Audio — Research Notes

## Overview

The `sound-board` app needs to play audio clips locally, potentially route them to specific audio outputs (e.g., only to stream, not to headphones), and trigger them via hotkeys.

## Audio Playback Approaches

### Web Audio API (Frontend)
- **Pros**: Simple, no backend needed, low latency
- **Cons**: Limited to browser audio routing, no system-level control
- **Best for**: Simple sound playback within the app

```typescript
const audio = new Audio('/sounds/clip.mp3');
audio.volume = 0.8;
audio.play();
```

### Tauri + Rodio (Rust Backend)
- **Pros**: System-level audio control, can target specific output devices
- **Cons**: More complex, requires Rust audio knowledge
- **Best for**: Advanced audio routing (stream vs. local)

```rust
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;

#[tauri::command]
fn play_sound(path: String) {
    let (_stream, stream_handle) = OutputStream::try_default().unwrap();
    let sink = Sink::try_new(&stream_handle).unwrap();
    let file = BufReader::new(File::open(path).unwrap());
    let source = Decoder::new(file).unwrap();
    sink.append(source);
}
```

### Tauri + cpal (Cross-Platform Audio I/O)
- **Pros**: Low-level audio device access, enumerate output devices
- **Cons**: More complex API
- **Best for**: Selecting specific audio output devices

## Audio Routing for Streamers

### The Problem
Streamers need sounds to go to:
1. **Stream only** (alert sounds, sound effects)
2. **Local only** (notification sounds, personal cues)
3. **Both** (music, general audio)

### Solutions

| Solution | Description | Complexity |
|----------|-------------|------------|
| Virtual Audio Cable | Software like VB-Cable, Voicemeeter | External dependency |
| OBS Audio Monitoring | OBS can route audio sources to specific outputs | OBS-specific |
| OS Audio Routing | Windows: App volume & device preferences | OS-level |
| Rust + cpal | Enumerate devices, play to specific device | High |

### Recommended Approach
1. Use Web Audio API for simple playback
2. Add device selection in settings (enumerate via Rust + cpal)
3. Document virtual audio cable setup for advanced routing
4. Consider integration with OBS audio monitoring

## Audio Formats

| Format | Support | Size | Use Case |
|--------|---------|------|----------|
| MP3 | Universal | Medium | General clips |
| WAV | Universal | Large | High quality, short clips |
| OGG | Good | Small | Open source preference |
| FLAC | Good | Medium | Lossless, archival |
| AAC | Good | Small | Compressed, good quality |

### Recommendation
- Accept MP3, WAV, OGG
- Convert to a consistent format on import
- Store in app data directory

## Hotkey Integration

### Global Hotkeys (Tauri)
Use `tauri-plugin-global-shortcut`:

```rust
use tauri_plugin_global_shortcut::GlobalShortcutExt;

app.handle().global_shortcut()
    .register("CmdOrCtrl+Shift+1", || {
        // Play sound 1
    });
```

### Frontend Hotkeys
For in-app hotkeys (when app is focused):
```typescript
import { useHotkeys } from 'react-hotkeys-hook';

useHotkeys('ctrl+1', () => playSound('clip1'));
useHotkeys('space', () => playSound('airhorn'));
```

## Sound Board UI Patterns

### Grid Layout
```
┌─────────────────────────────────────┐
│  [🔊 Airhorn]  [👏 Applause]  [🎵 Intro]  │
│  [😂 Laugh]    [😱 Scream]    [🎺 Horn]   │
│  [⏰ Timer]    [🔔 Bell]      [💥 Boom]   │
└─────────────────────────────────────┘
```

### Features
- **Drag & drop** to add sounds
- **Volume slider** per clip
- **Color coding** per category
- **Cooldown timer** to prevent spam
- **Fade in/out** controls
- **Loop** toggle for ambient sounds
- **Playlist** mode for sequential playback

## File Management

### Storage Structure
```
%APPDATA%/com.streamersuite.app/sounds/
├── default/
│   ├── airhorn.mp3
│   ├── applause.wav
│   └── ...
├── custom/
│   ├── my-sound.mp3
│   └── ...
└── playlists/
    ├── intro-sequence.json
    └── ...
```

### Import Flow
1. User drags file onto sound board or clicks "Add Sound"
2. File is copied to app data directory
3. Metadata extracted (duration, format, sample rate)
4. Waveform generated for visual display
5. Assigned to a grid slot

## References
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Rodio (Rust audio): https://crates.io/crates/rodio
- cpal (Rust audio I/O): https://crates.io/crates/cpal
- Tauri Global Shortcut: https://v2.tauri.app/plugin/global-shortcut/
- VB-Cable: https://vb-audio.com/Cable/
- Voicemeeter: https://vb-audio.com/Voicemeeter/
