import type { JoystickDocPage } from "./types.js";

const DEV_SUPPORT_URL = "https://support.joystick.tv/developer_support";

// Joystick.tv doesn't run a multi-page docs site like Kick or Twitch — its
// entire chatbot/API documentation lives on one page (developer_support.md
// in https://github.com/joysticktv/joysticktv.github.io), broken into
// headings. Each entry here corresponds to one heading on that page, sliced
// out by fetch-joystick-docs.ts. Re-run `npm run fetch-docs` to refresh when
// Joystick.tv updates their docs.
export const JOYSTICK_DOC_PAGES: JoystickDocPage[] = [
  { title: "Overview", slug: "overview", section: "Developer Support", heading: "Overview", url: `${DEV_SUPPORT_URL}#overview` },
  { title: "Creating a bot application", slug: "creating-a-bot-application", section: "Developer Support", heading: "Creating a bot application", url: `${DEV_SUPPORT_URL}#creating-a-bot-application` },
  { title: "Installing the bot application", slug: "installing-the-bot-application", section: "Developer Support", heading: "Installing the bot application", url: `${DEV_SUPPORT_URL}#installing-the-bot-application` },
  { title: "Public vs Private bots", slug: "public-vs-private-bots", section: "Developer Support", heading: "Public vs Private bots", url: `${DEV_SUPPORT_URL}#public-vs-private-bots` },
  { title: "Permissions", slug: "permissions", section: "Developer Support", heading: "Permissions", url: `${DEV_SUPPORT_URL}#permissions` },
  { title: "Installing bot API", slug: "installing-bot-api", section: "Developer Support", heading: "Installing bot API", url: `${DEV_SUPPORT_URL}#installing-bot-api` },
  { title: "Fetching access_token API", slug: "fetching-access-token-api", section: "Developer Support", heading: "Fetching access_token API", url: `${DEV_SUPPORT_URL}#fetching-access_token-api` },
  { title: "Fetching refresh_token API", slug: "fetching-refresh-token-api", section: "Developer Support", heading: "Fetching refresh_token API", url: `${DEV_SUPPORT_URL}#fetching-refresh_token-api` },
  { title: "Connecting the bot", slug: "connecting-the-bot", section: "Developer Support", heading: "Connecting the bot", url: `${DEV_SUPPORT_URL}#connecting-the-bot` },
  { title: "Subscribing", slug: "subscribing", section: "Developer Support", heading: "Subscribing", url: `${DEV_SUPPORT_URL}#subscribing` },
  { title: "Receiving messages", slug: "receiving-messages", section: "Developer Support", heading: "Receiving messages", url: `${DEV_SUPPORT_URL}#receiving-messages` },
  { title: "Sending messages", slug: "sending-messages", section: "Developer Support", heading: "Sending messages", url: `${DEV_SUPPORT_URL}#sending-messages` },
  { title: "REST API endpoints", slug: "rest-api-endpoints", section: "Developer Support", heading: "REST API endpoints", url: `${DEV_SUPPORT_URL}#rest-api-endpoints` },
  { title: "ManageStreamerSettings", slug: "managestreamersettings", section: "Developer Support", heading: "ManageStreamerSettings", url: `${DEV_SUPPORT_URL}#managestreamersettings` },
  { title: "ViewSubscriptions", slug: "viewsubscriptions", section: "Developer Support", heading: "ViewSubscriptions", url: `${DEV_SUPPORT_URL}#viewsubscriptions` },
  { title: "Testing Your Bot", slug: "testing-your-bot", section: "Developer Support", heading: "Testing Your Bot", url: `${DEV_SUPPORT_URL}#testing-your-bot` },
  { title: "Example Bots", slug: "example-bots", section: "Developer Support", heading: "Example Bots", url: `${DEV_SUPPORT_URL}#example-bots` },
  { title: "Changelog", slug: "changelog", section: "Overview", heading: "", url: "https://support.joystick.tv/changelog" },
];
