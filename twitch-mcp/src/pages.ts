import type { TwitchDocPage } from "./types.js";

// Twitch's developer docs (https://dev.twitch.tv/docs) aren't published from
// a public source repo the way Kick's are, so this list is a curated set of
// top-level pages verified to exist by URL (each title below matches that
// page's real "<Title> | Twitch Developers" page title). There's no
// machine-readable table of contents to diff against, so re-verify titles/
// URLs by hand if Twitch reorganizes their docs.
export const TWITCH_DOC_PAGES: TwitchDocPage[] = [
  { title: "Twitch Developer Documentation", slug: "docs-home", section: "Overview", url: "https://dev.twitch.tv/docs" },

  { title: "Register Your App", slug: "register-app", section: "Getting Started", url: "https://dev.twitch.tv/docs/authentication/register-app" },
  { title: "Get Started", slug: "api-get-started", section: "Getting Started", url: "https://dev.twitch.tv/docs/api/get-started" },

  { title: "Authentication", slug: "authentication", section: "Authentication", url: "https://dev.twitch.tv/docs/authentication" },
  { title: "Getting OAuth Access Tokens", slug: "getting-tokens-oauth", section: "Authentication", url: "https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/" },
  { title: "Using OIDC to get OAuth Access Tokens", slug: "getting-tokens-oidc", section: "Authentication", url: "https://dev.twitch.tv/docs/authentication/getting-tokens-oidc/" },
  { title: "Validating Tokens", slug: "validate-tokens", section: "Authentication", url: "https://dev.twitch.tv/docs/authentication/validate-tokens" },
  { title: "Twitch Access Token Scopes", slug: "scopes", section: "Authentication", url: "https://dev.twitch.tv/docs/authentication/scopes/" },

  { title: "Twitch API", slug: "api-overview", section: "API", url: "https://dev.twitch.tv/docs/api/" },
  { title: "Twitch API Concepts", slug: "api-guide", section: "API", url: "https://dev.twitch.tv/docs/api/guide" },
  { title: "Reference", slug: "api-reference", section: "API", url: "https://dev.twitch.tv/docs/api/reference" },
  { title: "Webhooks Reference (legacy)", slug: "webhooks-reference", section: "API", url: "https://dev.twitch.tv/docs/api/webhooks-reference" },

  { title: "EventSub", slug: "eventsub-overview", section: "EventSub", url: "https://dev.twitch.tv/docs/eventsub/" },
  { title: "EventSub Reference", slug: "eventsub-reference", section: "EventSub", url: "https://dev.twitch.tv/docs/eventsub/eventsub-reference/" },
  { title: "EventSub Subscription Types", slug: "eventsub-subscription-types", section: "EventSub", url: "https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/" },
  { title: "Managing Subscriptions", slug: "eventsub-manage-subscriptions", section: "EventSub", url: "https://dev.twitch.tv/docs/eventsub/manage-subscriptions/" },
  { title: "Helix Endpoints", slug: "eventsub-helix-endpoints", section: "EventSub", url: "https://dev.twitch.tv/docs/eventsub/helix-endpoints" },
  { title: "Authenticating and Setting up EventSub", slug: "chat-authenticating", section: "EventSub", url: "https://dev.twitch.tv/docs/chat/authenticating/" },

  { title: "Chat & Chatbots", slug: "chat-overview", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/chat/" },
  { title: "IRC Concepts", slug: "chat-irc", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/chat/irc/" },
  { title: "Getting Started with Chat & Chatbots", slug: "irc-get-started", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/irc/get-started/" },
  { title: "Authenticating with the Twitch IRC Server", slug: "irc-authenticate-bot", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/irc/authenticate-bot/" },
  { title: "Requesting Twitch IRC Capabilities", slug: "irc-capabilities", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/irc/capabilities/" },
  { title: "Migrating from Twitch IRC", slug: "chat-irc-migration", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/chat/irc-migration/" },
  { title: "Example Chatbot Guide", slug: "chat-chatbot-guide", section: "Chat & Chatbots", url: "https://dev.twitch.tv/docs/chat/chatbot-guide/" },

  { title: "Extensions", slug: "extensions-overview", section: "Extensions", url: "https://dev.twitch.tv/docs/extensions/" },
  { title: "Extensions Reference", slug: "extensions-reference", section: "Extensions", url: "https://dev.twitch.tv/docs/extensions/reference/" },
  { title: "Designing Extensions", slug: "extensions-designing", section: "Extensions", url: "https://dev.twitch.tv/docs/extensions/designing/" },
  { title: "Building Extensions", slug: "extensions-building", section: "Extensions", url: "https://dev.twitch.tv/docs/extensions/building/" },

  { title: "Call API endpoints", slug: "cli-api-command", section: "CLI", url: "https://dev.twitch.tv/docs/cli/api-command/" },
];
