## REST API endpoints

Most of the data you'll send/receive is done over the websocket during chats. There are a few endpoints available
(more to be added later) that will give you access to additional information.

These endpoints require a valid `access_token` (The JSON Web Token) which you get once a streamer installs your bot application.

Pass these headers in with your call

* `Authorization` - "Bearer THE_ACCESS_TOKEN". This is JWT you receive from the `authorization_code` or `refresh_token` oauth2 calls when the user installs the bot.
* `Content-Type` - "application/json"
* `X-JOYSTICK-STATE` - An optional value you can use to pass through arbitrary data that will be sent back with the response.