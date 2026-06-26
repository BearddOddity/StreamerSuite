# OAuth 2.0 / PKCE Authentication — Research Notes

## Why OAuth Matters for StreamerSuite

StreamerSuite needs to authenticate with multiple platforms (Twitch, YouTube, Kick, Discord) on behalf of the user. OAuth 2.0 with PKCE is the standard for native/desktop apps.

## OAuth 2.0 Flow for Desktop Apps

### Why PKCE?
- Desktop apps **cannot store client secrets securely** (they're embedded in the binary)
- PKCE (Proof Key for Code Exchange) prevents authorization code interception
- RFC 7636 — required for public clients
- All major platforms now support/require PKCE for native apps

### Authorization Code + PKCE Flow

```
┌──────────┐                              ┌──────────────┐
│  Desktop  │                              │ Auth Server  │
│   App     │                              │ (Platform)   │
└─────┬─────┘                              └──────┬───────┘
      │                                           │
      │  1. Generate code_verifier (random)       │
      │  2. Create code_challenge =               │
      │     BASE64URL(SHA256(code_verifier))       │
      │                                           │
      │  3. Open browser to auth URL:             │
      │     ?response_type=code                   │
      │     &client_id=xxx                        │
      │     &redirect_uri=...                     │
      │     &scope=...                            │
      │     &state=xxx                            │
      │     &code_challenge=xxx                   │
      │     &code_challenge_method=S256           │
      │──────────────────────────────────────────▶│
      │                                           │
      │  4. User logs in & authorizes             │
      │                                           │
      │  5. Redirect back with auth code:         │
      │     ?code=xxx&state=xxx                   │
      │◀──────────────────────────────────────────│
      │                                           │
      │  6. Exchange code for tokens:             │
      │     POST /token                           │
      │     grant_type=authorization_code         │
      │     &code=xxx                             │
      │     &redirect_uri=...                     │
      │     &code_verifier=xxx                    │
      │──────────────────────────────────────────▶│
      │                                           │
      │  7. Receive tokens:                       │
      │     { access_token, refresh_token,        │
      │       expires_in, scope }                 │
      │◀──────────────────────────────────────────│
      │                                           │
```

## Platform-Specific OAuth Details

### Twitch
- **Auth URL**: `https://id.twitch.tv/oauth2/authorize`
- **Token URL**: `https://id.twitch.tv/oauth2/token`
- **Client Type**: Public (no secret) — PKCE required
- **Scopes**: `chat:read`, `chat:edit`, `moderator:read:chatters`, `channel:read:subscriptions`, `channel:read:followers`, `user:read:email`, `channel:manage:broadcast`, etc.
- **Token Validation**: `https://id.twitch.tv/oauth2/validate`
- **Refresh**: Use `grant_type=refresh_token`
- **Special**: Twitch requires `client_id` in all API headers

### YouTube (Google)
- **Auth URL**: `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL**: `https://oauth2.googleapis.com/token`
- **Client Type**: Installed app — PKCE recommended
- **Scopes**: `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/youtube.force-ssml`
- **Access Type**: `offline` for refresh tokens
- **Prompt**: `consent` to force refresh token on first auth

### Kick
- **Auth URL**: `https://id.kick.com/oauth2/authorize`
- **Token URL**: `https://id.kick.com/oauth2/token`
- **Client Type**: Public — PKCE required
- **Scopes**: `user:read`, `channel:read`, `chat:write`, etc.

### Discord
- **Auth URL**: `https://discord.com/api/oauth2/authorize`
- **Token URL**: `https://discord.com/api/oauth2/token`
- **Client Type**: Confidential (has secret) — but PKCE still recommended
- **Scopes**: `identify`, `email`, `guilds`, `guilds.messages.read`, `bot`
- **Redirect**: Can use `http://localhost` or custom URI scheme
- **Special**: Discord also has a Bot token flow (different from user OAuth)

## Redirect URI Strategies for Desktop Apps

### Option 1: Localhost Redirect
- Register `http://localhost:PORT` or `http://127.0.0.1:PORT`
- Start a local HTTP server to catch the redirect
- **Pros**: Simple, widely supported
- **Cons**: Port conflicts, some platforms require fixed ports

### Option 2: Custom URI Scheme
- Register `streamersuite://auth/callback`
- OS opens the app when the URI is invoked
- **Pros**: Clean, no port needed
- **Cons**: Requires OS-level URI scheme registration

### Option 3: Loopback with Ephemeral Port
- Tauri's recommended approach
- Use `tauri-plugin-oauth` or similar
- Random available port, platform redirects to `http://127.0.0.1:<random>`

## Token Storage

### Security Requirements
- **Never store tokens in plaintext**
- Use OS keychain/keyring:
  - Windows: Credential Manager
  - macOS: Keychain
  - Linux: Secret Service / KWallet
- **Rust crate**: `keyring-rs` for cross-platform keychain access
- **Alternative**: Encrypted file in app data directory

### Token Refresh Strategy
1. Store `refresh_token`, `access_token`, `expires_at`
2. Before each API call, check if token is expired
3. If expired, use `refresh_token` to get new `access_token`
4. If refresh fails, prompt user to re-authenticate
5. Implement exponential backoff on refresh failures

## Implementation Notes for Tauri

### Recommended Approach
1. Use `tauri-plugin-shell` to open the system browser for auth
2. Start a local HTTP server (Rust side) to catch the redirect
3. Exchange the code for tokens in Rust (keeps `code_verifier` secure)
4. Store tokens in OS keychain via `keyring-rs`
5. Expose token status to frontend via Tauri commands

### Tauri Commands Needed
```rust
// Start OAuth flow
#[tauri::command]
async fn start_oauth(platform: String) -> Result<String, String>

// Check auth status
#[tauri::command]
async fn get_auth_status(platform: String) -> Result<AuthStatus, String>

// Revoke/logout
#[tauri::command]
async fn revoke_auth(platform: String) -> Result<(), String>
```

## References
- RFC 6749 (OAuth 2.0): https://datatracker.ietf.org/doc/html/rfc6749
- RFC 7636 (PKCE): https://datatracker.ietf.org/doc/html/rfc7636
- RFC 9700 (OAuth 2.1): https://datatracker.ietf.org/doc/html/rfc9700
- Twitch Auth: https://dev.twitch.tv/docs/authentication/
- Google OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
- Discord OAuth: https://discord.com/developers/docs/topics/oauth2
- keyring-rs: https://crates.io/crates/keyring
