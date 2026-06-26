# WebSocket Chat Integration — Research Notes

## Overview

The `chat-confluence` app needs to aggregate chat from multiple platforms into a unified view. Each platform uses different real-time communication mechanisms.

## Platform Chat Protocols Summary

| Platform | Protocol | Transport | Auth |
|----------|----------|-----------|------|
| Twitch | IRC over WebSocket | `wss://irc-ws.chat.twitch.tv:443` | OAuth token |
| YouTube | REST Polling | HTTPS (no WebSocket) | OAuth token |
| Kick | Pusher channels | WebSocket (Pusher) | Pusher auth |
| Discord | Gateway | `wss://gateway.discord.gg` | Bot/User token |

---

## Twitch IRC Chat

### Connection
```
wss://irc-ws.chat.twitch.tv:443
```

### Authentication Sequence
```
PASS oauth:<access_token>
NICK <username>
CAP REQ :twitch.tv/tags twitch.tv/commands
JOIN #<channel>
```

### IRCv3 Tags (Message Metadata)
```
@badge-info=subscriber/1;display-name=Username;emotes=;msg-id=resub;
  subscriber=1;tmi-sent-ts=1234567890;user-id=12345;user-type= : 
  username!username@username.tmi.twitch.tv PRIVMSG #channel :message
```

### Key Tags for Chat Display

| Tag | Purpose | Example |
|-----|---------|---------|
| `display-name` | User's display name | `OddTower` |
| `color` | Username color | `#FF0000` |
| `emotes` | Emote positions | `25:0-4,12-16/1902:6-10` |
| `badges` | Badge list | `subscriber/1,broadcaster/1` |
| `user-type` | User role | `mod`, `admin`, `global_mod` |
| `subscriber` | Sub status | `1` or `0` |
| `turbo` | Turbo status | `1` or `0` |
| `msg-id` | Message type | `resub`, `sub`, `ritual` |
| `bits` | Bits cheered | `100` |
| `id` | Message UUID | (unique per message) |
| `tmi-sent-ts` | Timestamp (ms) | `1234567890123` |
| `room-id` | Channel ID | `12345678` |
| `user-id` | User ID | `87654321` |

### Twitch Chat Commands (from bot/app)
```
PRIVMSG #channel :message        — Send message
JOIN #channel                    — Join channel
PART #channel                    — Leave channel
CLEARCHAT #channel [:target]     — Timeout/ban (mod only)
CLEARMSG #channel :msg-id        — Delete single message (mod only)
```

### Rate Limits
- **Regular user**: 20 messages per 30 seconds
- **Moderator**: 100 messages per 30 seconds
- **Known bot**: 100 messages per 30 seconds
- **Verified bot**: 7500 messages per 30 seconds

### Reconnection Strategy
1. On disconnect, wait 1 second, reconnect
2. Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (cap)
3. Reset backoff on successful connection
4. Re-join all previously joined channels

---

## YouTube Live Chat

### Polling Approach (No WebSocket)
```
GET https://www.googleapis.com/youtube/v3/liveChat/messages
  ?liveChatId=<id>
  &part=snippet,authorDetails
  &pageToken=<nextPageToken>
  &maxResults=2000
```

### Response Structure
```json
{
  "nextPageToken": "...",
  "pollingIntervalMillis": 5000,
  "items": [
    {
      "snippet": {
        "type": "textMessageEvent",
        "messageText": "Hello chat!",
        "publishedAt": "2024-01-01T00:00:00.000Z"
      },
      "authorDetails": {
        "displayName": "Username",
        "channelId": "UC...",
        "isChatModerator": false,
        "isChatOwner": false
      }
    }
  ]
}
```

### Message Types
- `textMessageEvent` — Regular chat message
- `superChatEvent` — Super Chat (paid highlight)
- `superStickerEvent` — Super Sticker
- `membershipGiftingEvent` — Gifted membership
- `giftMembershipReceivedEvent` — Received gifted membership
- `userBannedEvent` — User banned/timed out
- `chatEndedEvent` — Chat ended

### Polling Strategy
1. Initial request without `pageToken`
2. Use `pollingIntervalMillis` from response as delay
3. Pass `nextPageToken` for subsequent requests
4. Handle `HTTP 403` (chat ended) and `HTTP 404` (chat not found)

---

## Kick Chat (Pusher)

### Connection
```
ws://ws-mt1.pusher.com/app/<app_key>?protocol=7&client=js&version=8.4.0-rc2&flash=false
```

### Channel Subscription
```json
{
  "event": "pusher:subscribe",
  "data": {
    "auth": "<auth_token>",
    "channel": "private-channel.<channel_id>"
  }
}
```

### Chat Events
| Event | Data |
|-------|------|
| `App\Events\ChatMessageEvent` | Message with user, content, badges |
| `App\Events\FollowEvent` | New follower |
| `App\Events\SubscriptionEvent` | New sub/resub |
| `App\Events\GiftSubscriptionEvent` | Gift sub |

### Auth Flow
1. POST to Kick's Pusher auth endpoint with `socket_id` and `channel_name`
2. Receive `auth` token
3. Subscribe to channel with auth token

---

## Discord Gateway Chat

### Connection
```
wss://gateway.discord.gg/?v=10&encoding=json
```

### Identify Payload
```json
{
  "op": 2,
  "d": {
    "token": "<bot_token>",
    "intents": 33280,
    "properties": {
      "os": "windows",
      "browser": "StreamerSuite",
      "device": "StreamerSuite"
    }
  }
}
```

### Intents for Chat
| Intent | Value | Purpose |
|--------|-------|---------|
| GUILD_MESSAGES | 1 << 9 | Message events in guilds |
| DIRECT_MESSAGES | 1 << 12 | DM message events |
| MESSAGE_CONTENT | 1 << 15 | Access message content (privileged) |
| GUILD_PRESENCES | 1 << 8 | User presence updates |

### Key Events for Chat
| Event | Purpose |
|-------|---------|
| `MESSAGE_CREATE` | New message |
| `MESSAGE_UPDATE` | Edited message |
| `MESSAGE_DELETE` | Deleted message |
| `MESSAGE_REACTION_ADD` | Reaction added |
| `GUILD_MEMBER_UPDATE` | Member info changed |

### Heartbeat
- Receive `heartbeat_interval` in Identify response
- Send `op: 1` with last sequence number every interval
- Must acknowledge heartbeats or connection drops

### Resume on Disconnect
```json
{
  "op": 6,
  "d": {
    "token": "<token>",
    "session_id": "<session_id>",
    "seq": <last_sequence>
  }
}
```

---

## Unified Chat Message Schema

To display all platforms in one view, normalize to:

```typescript
interface UnifiedMessage {
  id: string;                    // Platform-specific message ID
  platform: 'twitch' | 'youtube' | 'kick' | 'discord';
  channelId: string;
  channelName: string;
  author: {
    id: string;
    name: string;
    displayName: string;
    color?: string;
    badges: Badge[];
    isModerator: boolean;
    isBroadcaster: boolean;
    isSubscriber: boolean;
  };
  content: string;
  emotes: Emote[];
  timestamp: number;             // Unix ms
  replyTo?: {
    id: string;
    authorName: string;
    content: string;
  };
  isAction: boolean;             // /me messages
  isDeleted: boolean;
}
```

## Implementation Architecture

### Rust Backend (Recommended)
Handle all platform connections in Rust:
- Single WebSocket connection per platform
- Unified message channel (tokio::sync::broadcast)
- Frontend subscribes to unified stream
- Survives React re-renders and navigation

### Connection Manager Pattern
```rust
struct ChatManager {
    twitch: Option<TwitchConnection>,
    youtube: Option<YouTubePoller>,
    kick: Option<KickConnection>,
    discord: Option<DiscordConnection>,
    tx: broadcast::Sender<UnifiedMessage>,
}

impl ChatManager {
    async fn connect_platform(&mut self, platform: Platform, creds: Credentials);
    async fn disconnect_platform(&mut self, platform: Platform);
    async fn send_message(&self, platform: Platform, channel: &str, content: &str);
}
```

## References
- Twitch IRC: https://dev.twitch.tv/docs/irc/
- Twitch IRC Tags: https://dev.twitch.tv/docs/irc/tags/
- Twitch IRC Commands: https://dev.twitch.tv/docs/irc/commands/
- YouTube Live Chat: https://developers.google.com/youtube/v3/live/docs/liveChatMessages
- Discord Gateway: https://discord.com/developers/docs/topics/gateway
- Pusher Protocol: https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
