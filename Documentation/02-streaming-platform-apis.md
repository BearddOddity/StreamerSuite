# Streaming Platform APIs — Research Notes

## Platforms to Support

StreamerSuite targets streamers who use platforms like Twitch, YouTube, Kick, and potentially Discord for community management. Each platform has its own API ecosystem.

---

## Twitch API

### Overview
- **Base URL**: `https://api.twitch.tv/helix`
- **Auth**: OAuth 2.0 (Client Credentials or Authorization Code with PKCE)
- **Rate Limits**: 800 points/minute for app access tokens
- **Docs**: https://dev.twitch.tv/docs/api/

### Key Endpoints for StreamerSuite

| Endpoint | Purpose | Relevant App |
|----------|---------|-------------|
| `GET /users` | Get broadcaster info | statusforge, stream-stats |
| `GET /channels/followers` | Follower count | stream-stats |
| `GET /streams` | Live status, viewer count | stream-stats, statusforge |
| `GET /games` | Game/category info | statusforge |
| `GET /channel_emotes` | Channel emotes | chat-confluence |
| `GET /chat/chatters` | Chat user list | chat-confluence |
| `GET /moderation/moderators` | Mod list | chat-confluence |
| `GET /schedule` | Stream schedule | stream-stats |
| `GET /clips` | Clip management | alerts-hub |
| `GET /eventsub/subscriptions` | EventSub management | alerts-hub |

### Twitch EventSub (Webhooks/WebSockets)
- Real-time event subscription system
- **WebSocket transport** preferred for desktop apps (no public URL needed)
- Events: channel.follow, channel.subscribe, channel.cheer, channel.raid, channel.go_live, etc.
- Connection flow:
  1. Connect to `wss://eventsub.wss.twitch.tv/ws`
  2. Receive `session_welcome` with session ID
  3. Subscribe to events via HTTP POST
  4. Receive events over WebSocket
- Reconnect handling: Twitch sends `session_reconnect` with a reconnect URL

### Twitch Chat (IRC over WebSocket)
- **Connection**: `wss://irc-ws.chat.twitch.tv:443`
- **Auth**: `oauth:<token>` + `NICK <username>`
- **Capabilities**: Request `twitch.tv/commands` and `twitch.tv/tags`
- **Message format**: IRC PRIVMSG with IRCv3 tags for badges, emotes, etc.
- **Rate limits**: 20 messages/30s for moderators, 100/30s for known bots

---

## YouTube Live Streaming API

### Overview
- **Base URL**: `https://www.googleapis.com/youtube/v3`
- **Auth**: OAuth 2.0 via Google (Authorization Code with PKCE)
- **Rate Limits**: 10,000 units/day (default quota)
- **Docs**: https://developers.google.com/youtube/v3/live/

### Key Endpoints

| Endpoint | Purpose | Relevant App |
|----------|---------|-------------|
| `GET /liveBroadcasts` | Active broadcast info | stream-stats, statusforge |
| `GET /liveChat/messages` | Live chat messages | chat-confluence |
| `POST /liveChat/messages` | Send chat messages | chat-confluence |
| `GET /liveChat/moderators` | Mod list | chat-confluence |
| `GET /videos` | Video metadata | stream-stats |
| `GET /channels` | Channel info | stream-stats |

### YouTube Live Chat Polling
- YouTube live chat uses **polling** (not WebSocket)
- Poll `liveChat/messages` every 5-10 seconds
- Use `nextPageToken` for pagination
- `pollingIntervalMillis` in response indicates optimal poll rate

---

## Kick API

### Overview
- **Base URL**: `https://api.kick.com/public/v1/`
- **Auth**: OAuth 2.0 (Authorization Code Grant)
- **Docs**: https://docs.kick.com/
- **Status**: Relatively new, still evolving

### Key Endpoints

| Endpoint | Purpose | Relevant App |
|----------|---------|-------------|
| `GET /users` | User info | stream-stats |
| `GET /channels` | Channel info | stream-stats |
| `GET /livestreams` | Live status | stream-stats |

### Kick Chat
- Uses **Pusher** WebSocket channels for real-time chat
- Channel format: `private-channel.{channel_id}`
- Events: `App\\Events\\ChatMessageEvent`, `App\\Events\\FollowEvent`, etc.
- Auth via Pusher's `/auth` endpoint with channel_name + socket_id

---

## Discord API

### Overview
- **Base URL**: `https://discord.com/api/v10`
- **Auth**: OAuth 2.0 (Bot token or user token)
- **Rate Limits**: Per-route rate limits with bucket system
- **Docs**: https://discord.com/developers/docs/

### Key Features for StreamerSuite

| Feature | API/Protocol | Relevant App |
|---------|-------------|-------------|
| Server/channel list | REST API | chat-confluence |
| Message history | REST API | chat-confluence |
| Real-time events | Gateway (WebSocket) | chat-confluence, alerts-hub |
| Voice status | Gateway intent | statusforge |
| Rich Presence | IPC (local) | statusforge |

### Discord Gateway (WebSocket)
- **URL**: `wss://gateway.discord.gg/?v=10&encoding=json`
- **Intents**: `GUILD_MESSAGES`, `DIRECT_MESSAGES`, `GUILD_PRESENCES`, `MESSAGE_CONTENT`
- **Heartbeat**: Required every `heartbeat_interval` ms
- **Identify**: Send token + intents on connect
- **Reconnect**: Resume with session_id + sequence number

---

## Cross-Platform Considerations

### Unified Chat View
To show chat from multiple platforms in one view:
1. Normalize message format across platforms
2. Map platform-specific features (emotes, badges) to a common schema
3. Handle different real-time mechanisms:
   - Twitch: IRC WebSocket
   - YouTube: Polling
   - Kick: Pusher WebSocket
   - Discord: Gateway WebSocket

### Auth Management
- Store tokens securely (OS keychain via Tauri or encrypted storage)
- Handle token refresh automatically
- Support multiple accounts per platform

### Rate Limiting
- Implement per-platform rate limiters
- Queue outgoing messages
- Back off on 429 responses

## References
- Twitch API: https://dev.twitch.tv/docs/api/
- Twitch EventSub: https://dev.twitch.tv/docs/eventsub/
- Twitch IRC: https://dev.twitch.tv/docs/irc/
- YouTube Live API: https://developers.google.com/youtube/v3/live/
- Kick API: https://docs.kick.com/
- Discord API: https://discord.com/developers/docs/
