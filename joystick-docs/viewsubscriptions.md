### ViewSubscriptions

The `ViewSubscriptions` permission allows the bot to fetch a list of the streamer's subscribers, and their subscription status.

**`GET` Fetch Subscriptions**

Returns a paginated list of subscriptions. Use the `page` and `per_page` query parameters to paginate the records.

Example (Where `JWT` is the token you got from authorization):

```bash
curl -XGET \
  -H "Authorization: Bearer JWT" \
  -H "Content-Type: application/json" \
  "https://api.joystick.tv/api/users/subscriptions?page=2&per_page=10"
```

Returns:

```json
{
  "items": [
    {
      "username": "joysticktest",
      "expires_at": "2022-01-01",
      "renewal": true,
      "streak": 4,
      "total_subscribed": 5,
      "nickname": "The G.O.A.T.",
      "username_color": "#ffaa00",
    },
    ...
  ],
  "pagination": {
    "next_page": "/api/users/subscriptions?page=3",
    "previous_page": "/api/users/subscriptions?page=1",
    "total_items": 30,
    "total_pages": 3
  }
}
```