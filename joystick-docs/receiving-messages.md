### Receiving messages

Being a websocket API, everything you get from the API will be a message. Each message will have a different structure depending on what the message is.

**PING** - A "ping" is a message that lets you know the connection is still alive. It will come through with `type` of "ping" and `message` as a unix timestamp.

```json
{
  "type":"ping",
  "message":1682098467
}
```

> This sends as message and not a standard ping for universal device compatibility [See Actioncable](https://github.com/rails/rails/blob/bd8aeead92c11dbd82ddb9f114ea63b0daf160b4/actioncable/lib/action_cable/connection/base.rb#L135)


**SUBSCRIPTION** - A subscription is when you connect to a specific streamer's channel. See "Subscribing" above for details

**CHAT MESSAGE** - These are each chat message that someone sends in the streamer's chat. Your most basic message will be sent with `identifier` and `message`.

```json
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "event": "ChatMessage",
    "createdAt": "2023-04-21T18:29:49Z",
    "messageId": "UUID",
    "type": "new_message",
    "visibility": "public",
    "text": "!timer 5m code",
    "botCommand": "timer",
    "botCommandArg": "5m",
    "emotesUsed": [],
    "author": {
      "slug": "joystickuser",
      "username": "joystickuser",
      "usernameColor": null,
      "displayNameWithFlair": {% raw %}"{{{moderatorBadge}}} joystickuser",{% endraw %}
      "signedPhotoUrl": "...",
      "signedPhotoThumbUrl": "...",
      "isStreamer": true,
      "isModerator": true,
      "isSubscriber": false
    },
    "streamer": {
      "slug": "joystickuser",
      "username": "joystickuser",
      "usernameColor": null,
      "signedPhotoUrl": "Uri",
      "signedPhotoThumbUrl": "Uri"
    },
    "channelId": "Hash",
    "mention": false,
    "mentionedUsername": null,
    "highlight": false
  }
}
```

> NOTE: The `channelId` is a unique hash for each streamer, and will not change even if the streamer changes their username. This value will be used to send messages to that channel.

**USER PRESENCE** - These are messages your bot receives when a user enters or leaves the chat.

```json
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "id": "UUID",
    "event": "UserPresence",
    "type": "enter_stream",
    "text": "joystickuser",
    "channelId": "Hash",
    "createdAt": "2023-04-21T18:29:49Z",
  }
}
```

The `type` will be either `enter_stream` or `leave_stream`

**STREAM EVENTS** - These are messages your bot receives when any special event happens on the stream.

> This list is constantly growing, and changing, and may be difficult to list all of the possible events.

```json
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "id": "UUID",
    "event": "StreamEvent",
    "type": "Started",
    "text": "joystickuser started streaming",
    "createdAt": "2023-04-21T18:29:49Z",
    "channelId": "Hash"
  }
}
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "id": "UUID",
    "event": "StreamEvent",
    "type": "Tipped",
    "text": "joystickuser tipped 2 tokens for <strong class='text-verdigris'>Hydrate</strong>",
    "metadata": "{
      \"who\": \"joystickuser\",
      \"what\": \"Tipped\",
      \"how_much\": 2,
      \"tip_menu_item\": \"Hydrate\"
    }",
    "createdAt": "2023-04-21T18:29:49Z",
    "channelId": "Hash"
  }
}
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "id": "UUID",
    "event": "StreamEvent",
    "type": "WheelSpinClaimed",
    "text": "joystickuser won Jiggles",
    "metadata": "{
      \"who\": \"joystickuser\",
      \"what\": \"WheelSpinClaimed\",
      \"how_much\": 32,
      \"prize\": \"Jiggles\"
    }",
    "createdAt": "2023-04-21T18:29:49Z",
    "channelId": "Hash"
  }
}
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "id": "UUID",
    "event": "StreamEvent",
    "type": "Followed",
    "text": "joystickuser followed you",
    "metadata": "{
      \"who\": \"joystickuser\",
      \"what\": \"Followed\"
    }",
    "createdAt": "2023-04-21T18:29:49Z",
    "channelId": "Hash"
  }
}
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "id": "UUID",
    "event": "StreamEvent",
    "type": "DeviceConnected",
    "text": "Device turned on",
    "metadata": "{}",
    "createdAt": "2023-04-21T18:29:49Z",
    "channelId": "Hash"
  }
}
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message":{
    "event":"StreamEvent",
    "id":"UUID",
    "type":"StreamEnding",
    "text":"Stream Ending Soon",
    "metadata":"{}",
    "createdAt":"2024-02-28T01:58:55Z",
    "channelId":"Hash"
  }
}
{
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "message": {
    "event": "StreamEvent",
    "id": "UUID",
    "type": "Ended",
    "text": "Stream Ended",
    "channelId": "Hash",
    "metadata": "{}",
    "createdAt": "2024-11-05T15:28:23Z"
  }
}
{
  "identifier":"{\"channel\":\"GatewayChannel\"}",
  "message": {
    "event":"StreamEvent",
    "id":"UUID",
    "type":"StreamResuming",
    "metadata":"{}",
    "createdAt":"2025-03-14T03:22:50Z",
    "text":"Stream Starting Soon",
    "channelId":"Hash",
  }
}
```