# OBS Scene Switching & Integration — Research Notes

## Overview

The `scene-switcher` app within StreamerSuite needs to communicate with OBS Studio to switch scenes, toggle sources, and potentially control transitions. The standard approach is the **OBS WebSocket protocol**.

## obs-websocket Protocol

### Connection
- **Default Port**: `4455` (OBS WebSocket v5)
- **Protocol**: WebSocket (JSON-based RPC)
- **Auth**: Password-based with challenge-response

### Connection Flow
```
1. Connect to ws://localhost:4455
2. Receive "Hello" message with:
   - obsWebSocketVersion
   - rpcVersion
   - authentication (if enabled)
3. If auth required:
   a. Generate: secret = base64_encode(sha256(password + salt))
   b. Generate: authentication = base64_encode(sha256(secret + challenge))
   c. Send "Identify" message with auth
4. Receive "Identified" message → connection ready
```

### Message Types
| Direction | Message | Purpose |
|-----------|---------|---------|
| C→S | `Identify` | Authenticate + register event subscriptions |
| C→S | `Request` | Call an OBS function |
| S→C | `RequestResponse` | Response to a request |
| S→C | `Event` | OBS event (scene change, stream start, etc.) |
| C→S | `RequestBatch` | Batch multiple requests |

### Key Requests for Scene Switcher

| Request | Category | Purpose |
|---------|----------|---------|
| `GetSceneList` | Scenes | List all scenes |
| `GetCurrentProgramScene` | Scenes | Get active scene |
| `SetCurrentProgramScene` | Scenes | Switch to a scene |
| `GetSceneItemList` | Sources | List sources in a scene |
| `GetSceneItemEnabled` | Sources | Check if source is visible |
| `SetSceneItemEnabled` | Sources | Toggle source visibility |
| `SetCurrentSceneTransition` | Transitions | Change transition type |
| `SetCurrentSceneTransitionDuration` | Transitions | Change transition duration |
| `TriggerCurrentSceneTransition` | Transitions | Trigger transition manually |
| `GetStreamStatus` | Stream | Check streaming status |
| `GetRecordStatus` | Record | Check recording status |
| `GetVirtualCamStatus` | VirtualCam | Check virtual cam status |

### Key Events to Subscribe To

| Event | Purpose | Relevant App |
|-------|---------|-------------|
| `CurrentProgramSceneChanged` | Scene was switched | scene-switcher, alerts-hub |
| `StreamStateChanged` | Stream started/stopped | alerts-hub, statusforge |
| `RecordStateChanged` | Recording started/stopped | alerts-hub |
| `SceneItemEnableStateChanged` | Source visibility changed | scene-switcher |
| `SceneCreated` / `SceneRemoved` | Scene list changed | scene-switcher |
| `InputCreated` / `InputRemoved` | Input list changed | sound-board |

### Request Example (JSON)
```json
{
  "op": 6,
  "d": {
    "requestType": "SetCurrentProgramScene",
    "requestId": "switch-to-gaming",
    "requestData": {
      "sceneName": "Gaming Scene"
    }
  }
}
```

### Event Example (JSON)
```json
{
  "op": 5,
  "d": {
    "eventType": "CurrentProgramSceneChanged",
    "eventIntent": 1,
    "eventData": {
      "sceneName": "Gaming Scene"
    }
  }
}
```

## Implementation in Tauri

### Rust Side
Use a WebSocket client (`tokio-tungstenite`) in the Rust backend:

```rust
use tokio_tungstenite::connect_async;
use futures_util::{SinkExt, StreamExt};

#[tauri::command]
async fn obs_switch_scene(scene_name: String) -> Result<(), String> {
    // Connect to obs-websocket, send SetCurrentProgramScene
}

#[tauri::command]
async fn obs_get_scenes() -> Result<Vec<String>, String> {
    // Connect to obs-websocket, send GetSceneList
}
```

### Frontend Side
```typescript
import { invoke } from '@tauri-apps/api/core';

async function switchScene(name: string) {
  await invoke('obs_switch_scene', { sceneName: name });
}

async function getScenes(): Promise<string[]> {
  return await invoke('obs_get_scenes');
}
```

## Advanced Scene Switching Features

### Scene Collections
- `GetSceneCollectionList` — list available collections
- `SetCurrentSceneCollection` — switch collection
- Useful for different streaming setups (gaming, IRL, etc.)

### Scene Transitions
- **Types**: Cut, Fade, Swipe, Slide, Stinger, etc.
- **Duration**: Configurable per transition
- **Stinger transitions**: Video file-based transitions with specific point

### Source Groups
- Group sources for batch operations
- Toggle entire groups (e.g., "Overlay" group, "Webcam" group)

### Studio Mode
- Preview/Program dual-scene mode
- `SetCurrentPreviewScene` — set preview without going live
- `TriggerStudioModeTransition` — transition preview to program
- `SetStudioModeEnabled` — toggle studio mode

## Alternatives to obs-websocket

| Method | Pros | Cons |
|--------|------|------|
| obs-websocket | Full control, real-time events | Requires plugin in older OBS |
| OBS HTTP (obs-websocket v4) | Simpler | Deprecated |
| obs-cli | No WebSocket needed | Limited functionality |
| OBS-RPC | Direct process communication | Fragile, version-dependent |

## Other Streaming Software

### Streamlabs Desktop
- Based on OBS, supports obs-websocket
- Has its own cloud-based API for some features
- Less standardized than OBS

### vMix
- Has its own TCP/HTTP API
- `http://localhost:8088/api/` — REST-like interface
- Supports WebSocket for events
- Different protocol entirely from OBS

### Elgato Stream Deck SDK
- Plugin SDK for Stream Deck hardware
- WebSocket-based communication
- Could complement StreamerSuite for physical button control

## References
- obs-websocket Protocol: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
- obs-websocket GitHub: https://github.com/obsproject/obs-websocket
- OBS WebSocket v5 API: https://obsproject.com/docs/reference.html
