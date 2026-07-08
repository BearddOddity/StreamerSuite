### Subscribing

Once the connection has been opened, you will send a `subscribe` message. This is a JSON formatted object.

> NOTE: Key names will always start with a lowercase letter, and the value for `command` will always be lowercase.

```json
{
  "command": "subscribe",
  "identifier": "{\"channel\":\"GatewayChannel\"}"
}
```

If the subscription is successful, you will receive

```json
{
  "type": "confirm_subscription",
  "identifier": "{\"channel\":\"GatewayChannel\"}"
}
```

If the subscription is rejected, you will receive

```json
{
  "type": "reject_subscription",
  "identifier": "{\"channel\":\"GatewayChannel\"}"
}
```