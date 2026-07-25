/** A named/auto-save snapshot of an overlay's settings, listable and
 * restorable via overlay_list_versions/overlay_restore_version. */
export interface VersionInfo {
  id: string;
  label: string;
  timestamp: number;
}

export interface OverlayEntry {
  file: string;
  name: string;
  /** True when this overlay was built with a Maker (has saved settings to reload for edit/duplicate). */
  editable: boolean;
  /** Which Maker built it, so the frontend opens the matching editor. Absent for a plain upload. */
  kind?: "template" | "canvas";
}

export type OverlayTemplateId =
  | "lower-third"
  | "corner-badge"
  | "ticker"
  | "text-box"
  | "goal-bar"
  | "cam-frame"
  | "alert-banner"
  | "countdown"
  | "now-playing"
  | "game-logo";

export interface TemplateDef {
  id: OverlayTemplateId;
  label: string;
  icon: string;
  description: string;
  positions: { value: string; label: string }[];
  hasSpeed?: boolean;
  hasGoal?: boolean;
  hasCountdownTarget?: boolean;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "lower-third",
    label: "Lower Third",
    icon: "▭",
    description: "Title + subtitle bar, classic broadcast style",
    positions: [
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-center", label: "Bottom Center" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
  },
  {
    id: "corner-badge",
    label: "Corner Badge",
    icon: "◆",
    description: "Small pill badge, e.g. a now-playing tag",
    positions: [
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
  },
  {
    id: "ticker",
    label: "Ticker",
    icon: "▬",
    description: "Scrolling announcement bar across the bottom (or top)",
    positions: [
      { value: "bottom", label: "Bottom" },
      { value: "top", label: "Top" },
    ],
    hasSpeed: true,
  },
  {
    id: "text-box",
    label: "Text Box",
    icon: "◻",
    description: "Static centered or corner panel, e.g. a BRB screen",
    positions: [
      { value: "center", label: "Center" },
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
  },
  {
    id: "goal-bar",
    label: "Goal Bar",
    icon: "▮",
    description: "Progress bar toward a follower/sub goal, driven by a live source",
    positions: [
      { value: "bottom", label: "Bottom" },
      { value: "top", label: "Top" },
    ],
    hasGoal: true,
  },
  {
    id: "cam-frame",
    label: "Webcam Frame",
    icon: "▢",
    description: "Decorative border around the canvas with an optional corner label",
    positions: [
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
  },
  {
    id: "alert-banner",
    label: "Alert Banner",
    icon: "🔔",
    description: "Flashier corner alert — pulsing border, e.g. for a bound follow/sub/tip event",
    positions: [
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
  },
  {
    id: "countdown",
    label: "Countdown Timer",
    icon: "⏳",
    description: "Ticks down to a set date/time — start delays, sub goals with a deadline, etc.",
    positions: [
      { value: "center", label: "Center" },
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ],
    hasCountdownTarget: true,
  },
  {
    id: "now-playing",
    label: "Now Playing Card",
    icon: "🎮",
    description:
      "Game art + sliding stats (Released/Genre/Publisher/Session), live from StatusForge — replicates the original Horizontal Left/Right, Vertical, and Info Box overlays",
    positions: [
      { value: "horizontal-left", label: "Horizontal (Art Left)" },
      { value: "horizontal-right", label: "Horizontal (Art Right)" },
      { value: "vertical", label: "Vertical" },
      { value: "compact", label: "Compact Cover (Art Inside Box)" },
      { value: "info-only", label: "Info Box Only (No Art)" },
    ],
  },
  {
    id: "game-logo",
    label: "Game Logo",
    icon: "🖼️",
    description: "Just the current game's logo art on a soft glow panel — live from StatusForge, replicates the original Logo overlay",
    positions: [],
  },
];

/**
 * Live values StreamerSuite tools publish via overlay_publish_data, shown
 * with a friendly label whether or not that tool has actually published
 * yet this session (a Goal Bar should be buildable before Stream Stats has
 * ever run). Any OTHER key a tool publishes — including a future tool this
 * list has never heard of — still shows up too: see useLiveSources, which
 * merges this list with whatever overlay_list_data_keys() reports live and
 * humanizes any key not named here. Adding a source here is a labeling
 * nicety, not a requirement for it to be usable.
 */
export const KNOWN_LIVE_SOURCES: { value: string; label: string }[] = [
  { value: "", label: "Static text" },
  { value: "viewers", label: "Viewers (Stream Stats)" },
  { value: "followers", label: "Followers (Stream Stats)" },
  { value: "subscribers", label: "Subscribers (Stream Stats)" },
  { value: "uptime", label: "Stream Uptime (Stream Stats)" },
  { value: "timer", label: "Timer (Stream Timer)" },
  { value: "scene", label: "Current Scene (Scene Switcher)" },
  { value: "latest_chat", label: "Latest Chat Message (Multi-Chat)" },
  { value: "now_playing_sound", label: "Now Playing Sound (Sound Board)" },
  { value: "stream_title", label: "Stream Title (Stream Manager)" },
  { value: "stream_category", label: "Stream Category (Stream Manager)" },
  { value: "latest_alert", label: "Latest Alert (Alerts Hub)" },
  { value: "cohost_reply", label: "AI Co-Host's Last Reply (AI Co-Host)" },
];

/** Turns an unrecognized published key like "chat_count" into "Chat Count" for display. */
export function humanizeSourceKey(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface BoundField {
  text: string;
  source: string;
}

export interface TemplateParams {
  template: OverlayTemplateId;
  title: BoundField;
  subtitle: BoundField;
  textColor: string;
  accentColor: string;
  bgOpacity: number;
  position: string;
  logoDataUri: string | null;
  speedSeconds: number | null;
  fontFamily: string;
  /** A user-uploaded font file, embedded as a data URI — takes priority over fontFamily when set. */
  customFontDataUri: string | null;
  customFontName: string;
  borderRadius: "sharp" | "soft" | "rounded";
  animationsEnabled: boolean;
  animationStyle: "pop" | "slide" | "fade";
  goal: number | null;
  textShadow: boolean;
  textStroke: boolean;
  /** Countdown template only — ISO datetime string the client ticks down to. */
  countdownTarget: string;
}

export const DEFAULT_TEMPLATE_PARAMS: TemplateParams = {
  template: "lower-third",
  title: { text: "Now Playing", source: "" },
  subtitle: { text: "", source: "" },
  textColor: "#ffffff",
  accentColor: "#9146ff",
  bgOpacity: 0.5,
  position: "bottom-left",
  logoDataUri: null,
  speedSeconds: 18,
  fontFamily: "",
  customFontDataUri: null,
  customFontName: "",
  borderRadius: "rounded",
  animationsEnabled: true,
  animationStyle: "pop",
  goal: 1000,
  textShadow: false,
  textStroke: false,
  countdownTarget: "",
};

/** One placed widget inside a Canvas overlay — the exact same per-widget
 * fields as a standalone overlay (`params`), plus where it sits and how big
 * it is inside the canvas (percent of the canvas, not pixels, so it holds
 * up across any OBS Browser Source resolution) and its stacking order. */
export interface CanvasElementT {
  id: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  zIndex: number;
  /** Prevents drag/resize in the Canvas Maker — editor-only, has no effect on the rendered overlay. */
  locked?: boolean;
  /** Elements sharing a groupId move together when any one of them is dragged. */
  groupId?: string | null;
  params: TemplateParams;
}

export function newCanvasElement(template: OverlayTemplateId, index: number): CanvasElementT {
  // Staggers new elements diagonally so they don't land exactly on top of
  // each other — purely a convenience for the first drag/nudge, not a
  // meaningful default.
  const offset = (index % 4) * 8;
  return {
    id: `el-${Date.now()}-${index}`,
    xPct: 8 + offset,
    yPct: 8 + offset,
    widthPct: 32,
    heightPct: 22,
    zIndex: index,
    params: { ...DEFAULT_TEMPLATE_PARAMS, template },
  };
}
