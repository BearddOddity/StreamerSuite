## Permissions

Bot applications can request several different permissions from the streamers. A streamer may choose to not install a bot based on the permissions you've requested. Once your bot is created, you cannot change your permissions. If you do need to change your permissions, you'll need to delete your current bot, and/or create a new one.

* SendMessage - Allows the bot to send a public chat message to the chat.
* SendWhisper - Allows the bot to send a private chat message to a specific user.
* ReadMessages - Allows the bot to receive all chat messages.
* DeleteMessage - Allows the bot to delete a specific chat message.
* BlockUser - Allows the bot to block another user from that streamer's chat. The bot CANNOT block the streamer
* MuteUser - Allows the bot to mute another user on that streamer's chat. The bot CANNOT mute the streamer
* ReceiveStreamEvents - Sends all stream events to the bot. (e.g. `Tipped`, `TipGoalMet`, `SubscriberOnlyStarted`, `StreamDroppedIn`, `GiftedSubscriptions`, `DeviceConnected`, `WheelSpinClaimed`, etc...)
* ViewUserPresence  - Tells the bot when a user has entered or left the chat
* ManageStreamerSettings - Read and Update certain streamer settings. (See the REST API below for more info.)

> More permissions may be added later as the API is expanded