## Connecting the bot

Your bot's access token will be different from the user's access token. The bot will use the same basic auth key
to connect as you send in the `Authorization` header from previous calls. (e.g. `Base64.encode("id:secret")`)

Create a new WebSocket object using the URL `wss://api.joystick.tv/cable?token=YOUR_BASIC_KEY`, and protocol `actioncable-v1-json`.

This connection should only be made once for your application. All streamers that install your bot will send messages
over the same websocket connection with different identifiers.

> If your library doesn't request `protocols`, you may need to just add the header `Sec-Websocket-Protocol` with the value `actioncable-v1-json`.