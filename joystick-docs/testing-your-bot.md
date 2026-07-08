## Testing Your Bot

Testing can be a bit difficult. Only streamers have access to a chat, so if you're not a streamer, your testing options are currently limited.

We have a special API endpoint you can use for testing.

Your application will send an HTTP POST request to the joystick token endpoint.

```txt
https://api.joystick.tv/echo
```

You will need to pass the following headers

* `Authorization` (required) - "Basic YOUR_BASIC_KEY". This is HTTP Basic auth using your bot's Client ID as the user, and Client Secret as the password separated by a `:` and converted to Base64. (e.g. `Base64.encode("client_id:client_secret")`)
* `Content-Type` (required) - "application/json"

Example:

```bash
curl -XPOST \
  -H "Authorization: Basic NTliC001BRMUozcGhuMWJNZVE=" \
  -H "Content-Type: application/json" \
  "https://api.joystick.tv/echo" \
  -d '{"sample": {"event": "SendMessage", "data": "!join"}}'
```

The post body is a JSON structure that will determine what type of test data you want your bot to receive.
By sending this POST, a sample message will be sent to your bot which you can use as if you were typing in a chat.

Here's a few options that you can currently test:

**SendMessage**

Send the `event` with `"SendMessage"`, and `data` as the text for a standard message.


```json
{
  "sample": {
    "event": "SendMessage",
    "data": "!test 123"
  }
}
```

This can be used for any random message including specific tips like `!tip 123`

**EnterStream**

Send the `event` with `"EnterStream"`. This will simulate someone entering the chat.

```json
{
  "sample": {
    "event": "EnterStream",
  }
}
```

**LeaveStream**

Send the `event` with `"LeaveStream"`. This will simulate someone leaving the chat.

```json
{
  "sample": {
    "event": "LeaveStream",
  }
}
```

**StreamEvent**

Send the `event` with `"StreamEvent"`. The `data` will determine the type of event.

Set `data` to `Tipped` to simulate a normal tip
```json
{
  "sample": {
    "event": "StreamEvent",
    "data": "Tipped"
  }
}
```

Set `data` to `TipMenu` to simulate a tip from a tip menu item
```json
{
  "sample": {
    "event": "StreamEvent",
    "data": "TipMenu"
  }
}
```

> Currently only `Tipped`, and `TipMenu` are supported for `StreamEvent`. More will be added in the future