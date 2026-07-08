## Fetching refresh_token API

The `access_token` has a limit access time, and is sure to expire. Once expired, you can request a new one by sending back the `refresh_token` you received from the previous `/token` call.

Your application will send an HTTP POST request to the joystick token endpoint.

```txt
https://api.joystick.tv/api/oauth/token
```

You will need to pass the following query params

* `grant_type` - "refresh_token"
* `refresh_token` - The last refresh token you received from us

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
  "https://api.joystick.tv/api/oauth/token?refresh_token=YOUR_REFRESH_TOKEN&grant_type=refresh_token"
```

Returns:

```json
{
  "access_token": "JSON_WEB_TOKEN",
  "token_type": "Bearer",
  "expires_in": 1682098467,
  "refresh_token": "NEW_REFRESH_TOKEN"
}
```