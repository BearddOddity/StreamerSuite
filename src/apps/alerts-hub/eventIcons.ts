// Custom event icons (follow/resub/gift/cheer/tip/raid) used to be managed
// from inside Multi-Chat's own settings drawer, but they're an Alerts &
// Events concern, not a chat-feed one — Multi-Chat only ever displays them
// (public/multichat/multichat.js's eventIconEl reads exactly the same
// storage this module writes). Kept on Multi-Chat's existing
// "bd-mc-settings" localStorage key rather than a new one, since that's
// already the one source of truth multichat.js reads at boot — moving the
// data itself would mean teaching multichat.js a second storage location
// for no reason.
const STORAGE_KEY = "bd-mc-settings";
// multichat.js listens for this on `window` and reloads its in-memory
// settings.eventIcons + re-renders, so a change made here while Multi-Chat
// is already mounted in the same document (it always is — see
// EmbeddedMultiChat.tsx) takes effect immediately, no reload needed.
export const EVENT_ICONS_CHANGED_EVENT = "bd-eventicons-changed";

export type EventIconType = "follow" | "resub" | "gift" | "cheer" | "tip" | "raid";

export const EVENT_ICON_TYPES: EventIconType[] = ["follow", "resub", "gift", "cheer", "tip", "raid"];

export const EVENT_ICON_DEFAULTS: Record<EventIconType, string> = {
  follow: "💜",
  resub: "🌟",
  gift: "🎁",
  cheer: "💎",
  tip: "🪙",
  raid: "⚔️",
};

export const EVENT_ICON_LABELS: Record<EventIconType, string> = {
  follow: "Follow",
  resub: "Sub / Resub",
  gift: "Gift Sub",
  cheer: "Cheer",
  tip: "Tip",
  raid: "Raid",
};

// bd-mc-settings holds Multi-Chat's whole settings blob (feed toggles,
// theme, etc.) — read/write it wholesale rather than a dedicated key, and
// touch only the eventIcons field, so nothing here can ever clobber a
// Multi-Chat-only setting it doesn't know about.
function readBlob(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function readEventIcons(): Partial<Record<EventIconType, string>> {
  const blob = readBlob();
  return (blob.eventIcons as Partial<Record<EventIconType, string>>) || {};
}

export function setEventIcon(type: EventIconType, dataUri: string | null) {
  const blob = readBlob();
  const eventIcons = { ...(blob.eventIcons as Record<string, string> | undefined) };
  if (dataUri) eventIcons[type] = dataUri;
  else delete eventIcons[type];
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...blob, eventIcons }));
  window.dispatchEvent(new CustomEvent(EVENT_ICONS_CHANGED_EVENT));
}
