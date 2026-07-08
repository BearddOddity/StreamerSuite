### ManageStreamerSettings

The `ManageStreamerSettings` permission allows the bot to fetch public streamer information, as well as update a few

**`GET` Fetch Stream Settings**

Returns public settings available for the specific streamer.

Example (Where `JWT` is the token you got from authorization):

```bash
curl -XGET \
  -H "Authorization: Bearer JWT" \
  -H "Content-Type: application/json" \
  "https://api.joystick.tv/api/users/stream-settings"
```

Returns:

```json
{
  "username": "joysticktest",
  "stream_title": "This is a stream title, also it can be nullable!",
  "chat_welcome_message": "This is the greeting message when people enter your chat, also it can be nullable!",
  "banned_chat_words": ["bleep", "bloop", "nullable"],
  "device_active": false,
  "photo_url": "https://joystick.tv/face.png",
  "live": true,
  "number_of_followers": 1234,
  "channel_id": "abc123"
}
```

> More data may be added later


**`PATCH` Update Stream Settings**

This endpoint allows you to update a few of the streamer's settings.

> Currently only `stream_title`, `chat_welcome_message`, and `banned_chat_words` are allowed to be updated

Example:

```bash
curl -XPATCH \
  -H "Authorization: Bearer JWT" \
  -H "Content-Type: application/json" \
  "https://api.joystick.tv/api/users/stream-settings" \
  -d '{"streamer": {"stream_title": "New Title", "chat_welcome_message": "Hey everyone", "banned_chat_words": ["new phrase or word"]}}'
```

Returns:

```json
{
  "username": "joysticktest",
  "stream_title": "New Title",
  "chat_welcome_message": "Hey everyone",
  "banned_chat_words": ["new phrase or word"],
  "device_active": false,
  "photo_url": "https://joystick.tv/face.png",
  "live": true,
  "number_of_followers": 1234,
  "channel_id": "abc123"
}
```