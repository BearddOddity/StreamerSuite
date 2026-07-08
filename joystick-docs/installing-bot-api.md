## Installing bot API

Your application should redirect the user to the joystick authorize endpoint.

```txt
https://joystick.tv/api/oauth/authorize
```

You will need to pass the following query params

* `response_type` - Required &mdash; the value must be set to `code`
* `client_id` - Required &mdash; Your bot's Client ID
* `scope` - "bot" &mdash; Not used currently.
* `state` - This is an optional string value you can use for validation to ensure data has not been tampered with between OAuth2 transactions.

Example:

```txt
https://joystick.tv/api/oauth/authorize?response_type=code&client_id=00000000-0000-0000-0000-000000000000&scope=bot&state=myspecialtoken
```