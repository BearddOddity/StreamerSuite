# Stream Overlays & Alerts — Research Notes

## Overview

The `alerts-hub` app handles real-time stream alerts (follows, subs, raids, donations) and potentially serves as a source for stream overlays.

## Alert Types by Platform

### Twitch Events (via EventSub)
| Event | Trigger | Data |
|-------|---------|------|
| `channel.follow` | New follower | User name, profile image |
| `channel.subscribe` | New sub | User, tier, months, streak |
| `channel.subscription.gift` | Gift sub | Gifter, recipient, tier, count |
| `channel.cheer` | Bits cheered | User, bits amount, message |
| `channel.raid` | Incoming raid | Raider, viewer count |
| `channel.channel_points_custom_reward_redemption` | Channel point redemption | User, reward, message |
| `channel.poll.begin/progress/end` | Poll events | Poll data |
| `channel.prediction.begin/progress/end` | Prediction events | Prediction data |
| `channel.go_live` | Stream started | Stream info |
| `channel.go_offline` | Stream ended | Channel info |

### Discord Events
| Event | Trigger | Data |
|-------|---------|------|
| `GUILD_MEMBER_JOIN` | New server member | User info |
| `GUILD_BOOST` | Server boost | User, tier |

### YouTube Events (via PubSubHubbub polling)
| Event | Trigger | Data |
|-------|---------|------|
| `superChatEvent` | Super Chat | User, amount, message |
| `newSponsorEvent` | New member | User, tier |
| `membershipGiftingEvent` | Gift membership | Gifter, count |

## Alert Display Architecture

### Option 1: In-App Alert Queue
- Alerts displayed within the StreamerSuite window
- Simple to implement
- Only visible when app is focused

### Option 2: Browser Source Overlay
- Tauri serves a local HTTP endpoint
- OBS adds it as a Browser Source
- Alerts appear on stream
- Requires a secondary window or embedded server

### Option 3: Separate Overlay Window
- Tauri creates a transparent, always-on-top window
- Positioned over the stream preview
- Can be captured by OBS window capture

## Browser Source Approach (Recommended)

### Implementation
1. Tauri app serves overlay HTML at `http://localhost:<port>/overlay`
2. OBS adds Browser Source pointing to that URL
3. Alerts are sent via WebSocket or Server-Sent Events
4. Overlay uses CSS animations for alert effects

### Overlay HTML Structure
```html
<div id="alert-container">
  <div class="alert alert-follow" data-id="...">
    <img class="avatar" src="..." />
    <div class="content">
      <span class="username">OddTower</span>
      <span class="action">just followed!</span>
    </div>
  </div>
</div>
```

### Alert Animation Pattern
```css
.alert {
  animation: alert-enter 0.5s ease-out, alert-exit 0.5s ease-in 5s forwards;
}

@keyframes alert-enter {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes alert-exit {
  from { opacity: 1; }
  to { opacity: 0; transform: scale(0.8); }
}
```

## Alert Queue Management

### Queue Strategy
```typescript
interface AlertQueue {
  maxVisible: number;        // Max simultaneous alerts (e.g., 3)
  displayDuration: number;   // How long each alert shows (ms)
  cooldownPeriod: number;    // Min time between same-type alerts
  priority: AlertPriority;   // Which alerts show first
}

enum AlertPriority {
  DONATION = 1,    // Highest
  RAID = 2,
  SUB_GIFT = 3,
  SUBSCRIBE = 4,
  FOLLOW = 5,      // Lowest
}
```

### Deduplication
- Track recent alerts by type + user
- Suppress duplicate alerts within cooldown window
- Aggregate rapid events (e.g., "5 new followers!")

## Customization

### Per-Alert Settings
- **Sound**: Custom audio clip per alert type
- **Image/GIF**: Custom visual per alert type
- **Animation**: Choose from preset animations
- **Duration**: How long the alert displays
- **Text template**: Customizable message format

### Template System
```
{{user}} just {{action}}!
{{user}} cheered {{amount}} bits!
{{user}} gifted {{count}} subs to the community!
```

## Tauri Multi-Window for Overlays

### Creating an Overlay Window
```rust
use tauri::Manager;

#[tauri::command]
fn create_overlay_window(app: tauri::AppHandle) {
    let _overlay = tauri::WebWindowBuilder::new(
        &app,
        "overlay",
        tauri::WebviewUrl::App("overlay.html".into()),
    )
    .title("StreamerSuite Overlay")
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .build()
    .unwrap();
}
```

### Window Configuration
- **Decorations**: false (no title bar)
- **Always on top**: true
- **Transparent**: true (for chroma-key style overlays)
- **Resizable**: true (streamer can size to fit)
- **Skip taskbar**: true (don't show in taskbar)

## References
- Twitch EventSub: https://dev.twitch.tv/docs/eventsub/
- OBS Browser Source: https://obsproject.com/wiki/Browser-Source
- Tauri Multi-Window: https://v2.tauri.app/develop/window/
- StreamElements Alert Box (reference): https://streamelements.com/
- Streamlabs Alert Box (reference): https://streamlabs.com/
