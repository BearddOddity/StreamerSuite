### Sending messages

To send a message, you will send a JSON formatted object

**CHAT MESSAGES**

```json
{
  "command": "message",
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "data": "{
    \"action\": \"send_message\",
    \"text\": \"Hello World\",
    \"channelId\": \"Hash\"
  }"
}
```

**WHISPERS**

```json
{
  "command": "message",
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "data": "{
    \"action\": \"send_whisper\",
    \"username\": \"joystickdev\",
    \"text\": \"this is a secret\",
    \"channelId\": \"Hash\"
  }"
}
```

**DELETE MESSAGE**

```json
{
  "command": "message",
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "data": "{
    \"action\": \"delete_message\",
    \"messageId\": \"UUID\",
    \"channelId\": \"Hash\"
  }"
}
```

**MUTE USER**

Send the `messageId` of the message sent in, and the author of that message will be muted.

```json
{
  "command": "message",
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "data": "{
    \"action\": \"mute_user\",
    \"messageId\": \"UUID\",
    \"channelId\": \"Hash\"
  }"
}
```

**UNMUTE USER**

Send the `username` of the user to unmute.

```json
{
  "command": "message",
  "identifier": "{\"channel\":\"GatewayChannel\",\"streamer\":\"joystickuser\"}",
  "data": "{
    \"action\": \"unmute_user\",
    \"username\": \"joystickuser\",
    \"channelId\": \"Hash\"
  }"
}
```

**BLOCK USER**

Send the `messageId` of the message sent in, and the author of that message will be blocked.

```json
{
  "command": "message",
  "identifier": "{\"channel\":\"GatewayChannel\"}",
  "data": "{
    \"action\": \"block_user\",
    \"messageId\": \"UUID\",
    \"channelId\": \"Hash\"
  }"
}
```

> Blocks are a very serious matter, and each block will alert joystick staff in order to investigate any potential harrasment or threats. For this reason, bots cannot unblock users. This must be done manually by the streamer.