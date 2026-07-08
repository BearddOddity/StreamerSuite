## Fetching access_token API

After a streamer has authorized your bot, you will be given an "authorization_code" that will be used to request the `access_token`. This endpoint is the redirect URL you configured when setting up your bot.

After the user has authorized the bot, and is redirected back to your application, you will receive the `code` and `state` query params. The `code` is what you will use to request your `access_token`, and `state` will be the value you originally sent.

> NOTE: If you receive the `state` back, and the value is different than you originally sent, you should immediately cancel all connections as this could be a sign of a [MITM](https://en.wikipedia.org/wiki/Man-in-the-middle_attack) attack on your bot.

Your application will send an HTTP POST request to the joystick token endpoint.

```txt
https://api.joystick.tv/api/oauth/token
```

You will need to pass the following query params

* `redirect_uri` - This is not currently used, but may be used in the future.
* `code` - The short-lived authorization code we sent back through the query string.
* `grant_type` - "authorization_code"

As well as the following headers

* `Authorization` - "Basic YOUR_BASIC_KEY". This is HTTP Basic auth using your bot's Client ID as the user, and Client Secret as the password separated by a `:` and converted to Base64. (e.g. `Base64.encode("id:secret")`)
* `Content-Type` - "application/x-www-form-urlencoded"
* `X-JOYSTICK-STATE` - An optional value you can use to pass through arbitrary data that will be sent back with the response.
* `Accept` - Header indicating that the client expects a response in the `application/json` format.


Example:

```bash
curl -XPOST \
  -H "Authorization: Basic YOUR_BASIC_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  "https://api.joystick.tv/api/oauth/token?redirect_uri=unused&code=YOUR_OAUTH_CODE&grant_type=authorization_code"
```

Returns:

```json
{
  "access_token": "JSON_WEB_TOKEN",
  "token_type": "Bearer",
  "expires_in": 1682098467,
  "refresh_token": "REFRESH_TOKEN"
}
```