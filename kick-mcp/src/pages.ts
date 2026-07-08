import type { KickDocPage } from "./types.js";

// Mirrors the table of contents at https://docs.kick.com/ (source:
// https://github.com/KickEngineering/KickDevDocs/blob/main/SUMMARY.md).
// Re-run `npm run fetch-docs` to refresh this list when Kick updates its docs.
export const KICK_DOC_PAGES: KickDocPage[] = [
  { title: "Welcome", slug: "readme", section: "Overview", path: "README.md", url: "https://docs.kick.com/" },
  { title: "Changelog", slug: "changelog", section: "Overview", path: "changelog.md", url: "https://docs.kick.com/changelog" },

  { title: "App Setup", slug: "app-setup", section: "Getting Started", path: "getting-started/kick-apps-setup.md", url: "https://docs.kick.com/getting-started/kick-apps-setup" },
  { title: "OAuth 2.1", slug: "oauth2-1", section: "Getting Started", path: "getting-started/generating-tokens-oauth2-flow.md", url: "https://docs.kick.com/getting-started/generating-tokens-oauth2-flow" },
  { title: "Scopes", slug: "scopes", section: "Getting Started", path: "scopes/scopes.md", url: "https://docs.kick.com/getting-started/scopes" },

  { title: "Categories", slug: "categories", section: "APIs", path: "apis/categories.md", url: "https://docs.kick.com/apis/categories" },
  { title: "Users", slug: "users", section: "APIs", path: "apis/users.md", url: "https://docs.kick.com/apis/users" },
  { title: "Channels", slug: "channels", section: "APIs", path: "apis/channels.md", url: "https://docs.kick.com/apis/channels" },
  { title: "Channel Rewards", slug: "channel-rewards", section: "APIs", path: "apis/channel-rewards.md", url: "https://docs.kick.com/apis/channel-rewards" },
  { title: "Chat", slug: "chat", section: "APIs", path: "apis/chat.md", url: "https://docs.kick.com/apis/chat" },
  { title: "Moderation", slug: "moderation", section: "APIs", path: "apis/moderation.md", url: "https://docs.kick.com/apis/moderation" },
  { title: "Livestreams", slug: "livestreams", section: "APIs", path: "apis/livestreams.md", url: "https://docs.kick.com/apis/livestreams" },
  { title: "Public Key", slug: "public-key", section: "APIs", path: "apis/public-key.md", url: "https://docs.kick.com/apis/public-key" },
  { title: "KICKs", slug: "kicks", section: "APIs", path: "apis/kicks.md", url: "https://docs.kick.com/apis/kicks" },
  { title: "FAQs", slug: "api-faqs", section: "APIs", path: "apis/faqs.md", url: "https://docs.kick.com/apis/faqs" },

  { title: "Introduction", slug: "events-introduction", section: "Events", path: "events/introduction.md", url: "https://docs.kick.com/events/introduction" },
  { title: "Webhooks", slug: "webhook-security", section: "Events", path: "events/webhook-security.md", url: "https://docs.kick.com/events/webhook-security" },
  { title: "Subscribe to Events", slug: "subscribe-to-events", section: "Events", path: "events/subscribe-to-events.md", url: "https://docs.kick.com/events/subscribe-to-events" },
  { title: "Webhook Payloads", slug: "event-types", section: "Events", path: "events/event-types.md", url: "https://docs.kick.com/events/webhook-payloads" },

  { title: "Organization Management", slug: "organization-management", section: "Organizations", path: "organizations/organization-management.md", url: "https://docs.kick.com/organizations/organization-management" },

  { title: "Guide", slug: "drops-guide", section: "Drops", path: "drops/drops-guide.md", url: "https://docs.kick.com/drops/guide" },
  { title: "FAQs", slug: "drops-faqs", section: "Drops", path: "drops/drops-faqs.md", url: "https://docs.kick.com/drops/faqs" },
  { title: "Public API", slug: "drops-public-api", section: "Drops", path: "drops/public-api.md", url: "https://docs.kick.com/drops/public-api" },

  { title: "Contributing", slug: "contributing", section: "How do I contribute?", path: "CONTRIBUTING.md", url: "https://docs.kick.com/how-do-i-contribute/contributing" },
  { title: "Community Driven Projects", slug: "community-projects", section: "How do I contribute?", path: "community/community-projects.md", url: "https://docs.kick.com/how-do-i-contribute/community-driven-projects" },
];
