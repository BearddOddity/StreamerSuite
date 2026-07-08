Authentication | Twitch Developers
Contents
Authentication
Twitch APIs use
OAuth 2.0
access tokens to access resources. If you’re not already familiar with the specification, reading it may help you better understand how to get access tokens to use with the Twitch API.
The Twitch APIs use two types of access tokens:
user access tokens
and
app access tokens
. The
reference content
for each API identifies the type of access token you must use to access its resource. Some APIs require a user access token, others require a user access token or an app access token, and a few like the EventSub APIs require app access tokens.
IMPORTANT
Treat access tokens, refresh tokens, and client secrets like a password and safeguard them.
User access tokens
APIs that require the user’s permission to access resources use user access tokens. Twitch uses scopes to identify the resources, or the fields within a resource, that your app needs permission to access. For example, you don’t need permission to get a user’s User resource but you do need their permission to include their email address with the resource.
The following example shows the dialog that Twitch displays to the user to get their permission for your app to
create a Poll
,
stop a Poll
, or
get a list
of their Polls. If the user clicks
Authorize
, Twitch gives your app an access token that lets it perform those actions.
Based on the type of app you’re building, you’ll use one of the following OAuth flows to get a user access token.
Flow
Description
Implicit grant flow
Use this flow if your app does not use a server. For example, use this flow if your app is a client-side JavaScript app or mobile app. For details about getting a user access token using this flow, see
Implicit grant flow
.
Authorization code grant flow
Use this flow if your app uses a server, can securely store a client secret, and can make server-to-server requests to the Twitch API. For details about getting a user access token using this flow, see
Authorization code grant flow
.
Device code grant flow
Use this flow if your application has limited input capabilities or lacks a suitable browser; such as set-top boxes, games, or Electron applications. For details about getting a token using this flow, see
Device code grant flow
.
App access tokens
APIs that don’t require the user’s permission to access resources use app access tokens. For example, you can get a
list of videos
without the user’s permission.
You should get an app access token, if your app only calls APIs that don’t require the user’s permission to access the resource. But if your app also calls APIs that require a user access token, you should just get a user access token because in most cases you can use the user access token to call APIs that accept app access tokens. The exception is if you call the EventSub APIs (for example,
Create EventSub Subscription
). If you call the EventSub APIs and use webhooks, you must also get an app access token because the calls fail if you try to use a user access token.
To get an app access token, use the client credentials grant flow. For details, see
Client credentials grant flow
.
Authentication flows
The following table summarizes the flows you can use and the type of access token it returns.
Procedure
User Access Token
ID Token
App Access Token
OIDC Implicit Code Grant Flow
✔
✔
OAuth Implicit Code Grant Flow
✔
OIDC Authorization Code Grant Flow
✔
✔
OAuth Authorization Code Grant Flow
✔
OAuth Device Code Grant Flow
✔
OAuth Client Credentials Grant Flow
✔
NOTE
An ID token or identity token encodes the user’s identity in a JSON Web Token (JWT). It’s used in
OpenID Connect
client apps to sign in users. You cannot use the ID token in place of a user or app access token when calling the Twitch API.
Read more about ID tokens
.
Passing the access token to the API
After getting an access token using one of the above authentication flows, use it to set an API request’s Authorization header.
Authorization: Bearer <access token goes here>
For an API request that shows using the header, see
Get channel information
.
Tokens don’t last forever
Access and refresh tokens can become invalid for the following reasons:
The token expires.
The user changes their password.
Twitch revokes the token.
The user disconnects your app by going to their account’s
/settings/connections
page and clicking
Disconnect
next to your app’s name.
If a token becomes invalid, your API requests return HTTP status code 401 Unauthorized. When this happens, you’ll need to get a new access token using the appropriate flow for your app.
Validating tokens for third-party apps
Third-party apps that call the Twitch APIs and maintain an OAuth session
must
call the
/validate
endpoint to verify that the access token is still valid.
Read more
Next steps
Before you can get an access token you need to register your app. For details, see
Registering your app
.
Check out these code samples that show how to get access tokens:
Go
Node.js
Provide feedback for this page
Docs
Support
Showcase
Blog