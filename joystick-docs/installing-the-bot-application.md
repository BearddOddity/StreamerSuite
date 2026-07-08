### Installing the bot application

As a streamer...

1. User goes to your bot application and requests to install
1. Your bot application redirects the user to joystick.tv to grant permission
1. The user authorizes the install given the permissions you've set and is redirected back to your bot application.
1. Your bot application is given an "authorization_code" which your bot application will use to obtain an `access_token`.
1. Your bot application is now installed on the user's account.
1. Future API endpoints will use the `access_token` for requesting information from the user's account.