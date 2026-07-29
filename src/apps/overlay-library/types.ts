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

/** A placed element is either one of the 10 pre-designed template widgets,
 * or a free-form primitive shape/text/image layer. "template" is the
 * default/absent value — every canvas saved before primitives existed has
 * no `kind` field at all and should keep behaving exactly as it did. */
export type ElementKind = "template" | "rect" | "ellipse" | "line" | "text" | "image" | "icon";

export interface PrimitiveDef {
  id: Exclude<ElementKind, "template">;
  label: string;
  icon: string;
}

export const PRIMITIVES: PrimitiveDef[] = [
  { id: "rect", label: "Rectangle", icon: "▭" },
  { id: "ellipse", label: "Ellipse", icon: "⬭" },
  { id: "line", label: "Line", icon: "➖" },
  { id: "text", label: "Text", icon: "T" },
  { id: "image", label: "Image", icon: "🖼" },
  { id: "icon", label: "Icon", icon: "★" },
];

/** Style fields for a free-form primitive layer — a single self-contained
 * shape/text/image, not a whole composed widget the way TemplateParams is.
 * Every field applies to every kind except where noted; unused fields for a
 * given kind (e.g. `text` on a rectangle) are simply ignored at render time
 * rather than needing a separate type per kind. */
export const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** Mirrors AlertKind in src/apps/alerts-hub/types.ts — kept as its own copy
 * (not an import from alerts-hub) since overlay-library shouldn't depend on
 * a specific tool's app folder for a value list this generic. */
export const ALERT_KINDS: { id: string; label: string }[] = [
  { id: "follow", label: "Follow" },
  { id: "sub", label: "Subscribe" },
  { id: "raid", label: "Raid" },
  { id: "cheer", label: "Cheer/Bits" },
  { id: "tip", label: "Tip" },
];

export const CLIP_SHAPES: { id: string; label: string }[] = [
  { id: "none", label: "None" },
  { id: "circle", label: "Circle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "rounded", label: "Rounded" },
  { id: "diamond", label: "Diamond" },
  { id: "hexagon", label: "Hexagon" },
  { id: "octagon", label: "Octagon" },
];

export const VALUE_CONDITION_OPERATORS: { id: string; label: string }[] = [
  { id: ">", label: ">" },
  { id: ">=", label: "≥" },
  { id: "<", label: "<" },
  { id: "<=", label: "≤" },
  { id: "==", label: "=" },
  { id: "!=", label: "≠" },
];

/** Ties an element's visibility to a live data value crossing a threshold
 * — e.g. "show once followers >= 100" — rather than to a one-off event the
 * way AlertTrigger is. Level-based, not momentary: the element is visible
 * for exactly as long as the condition holds, no duration/auto-hide. */
export interface ValueCondition {
  enabled: boolean;
  /** A live source key (see KNOWN_LIVE_SOURCES) or any custom key a tool publishes. */
  source: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=";
  threshold: number;
}

export const DEFAULT_VALUE_CONDITION: ValueCondition = {
  enabled: false,
  source: "viewers",
  operator: ">=",
  threshold: 0,
};

export interface AlertTrigger {
  enabled: boolean;
  /** Empty = matches every alert kind. */
  kinds: string[];
  durationSeconds: number;
  animationStyle: "pop" | "slide" | "fade";
  /** Optional sound-on-event — plays once, right as the element shows,
   * alongside its entrance animation. null = silent (visual-only trigger,
   * the original behavior before this field existed). */
  soundDataUri: string | null;
  soundVolume: number;
}

export const DEFAULT_ALERT_TRIGGER: AlertTrigger = {
  enabled: false,
  kinds: [],
  durationSeconds: 5,
  animationStyle: "pop",
  soundDataUri: null,
  soundVolume: 0.7,
};

export interface PrimitiveParams {
  fill: string;
  fillOpacity: number;
  /** "solid" uses `fill` alone; "linear"/"radial" blend `fill` -> `fillColor2`
   * (a 2-stop gradient, not full multi-stop editing — kept simple on purpose). */
  fillType: "solid" | "linear" | "radial";
  fillColor2: string;
  /** Linear gradient direction in degrees — ignored for solid/radial. */
  gradientAngle: number;
  stroke: string;
  strokeWidth: number;
  /** Rectangle only — ellipse is always fully rounded, other kinds ignore it. */
  cornerRadius: number;
  opacity: number;
  /** CSS mix-blend-mode against whatever's beneath this element — lets a
   * shape/image/text genuinely composite with other layers instead of
   * always sitting flatly on top. */
  blendMode: BlendMode;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  /** Text kind only. */
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  textAlign: "left" | "center" | "right";
  /** Text kind only. Pixels; 0 = font's own default spacing/line-height. */
  letterSpacing: number;
  lineHeight: number;
  /** Text kind only — an outline, independent of the shared Drop Shadow. */
  textStroke: boolean;
  textStrokeColor: string;
  textStrokeWidth: number;
  /** Image kind only. */
  imageDataUri: string | null;
  objectFit: "contain" | "cover" | "fill";
  /** Image kind only, and only meaningful when objectFit is "cover" (the
   * only fit mode where the image can overflow its box) — 0-100%, CSS
   * object-position's own percentage semantics: 50/50 is centered, 0/0
   * pins the image's top-left corner to the box's top-left. */
  objectPositionX: number;
  objectPositionY: number;
  /** Icon kind only — one of ICON_LIBRARY's ids. Recolored via the shared
   * `fill` field (icons are drawn with currentColor) rather than needing
   * their own color field. */
  iconId: string;
  /** Plays once when the overlay loads — same style vocabulary as
   * TemplateParams' own animationsEnabled/animationStyle, kept as a
   * separate field (not shared) since a primitive and a template render
   * through entirely different code paths. Off by default, unlike
   * templates: a plain background rect popping in on every load is more
   * often unwanted noise than a lower-third's entrance is. */
  animationsEnabled: boolean;
  animationStyle: "pop" | "slide" | "fade";
}

export const DEFAULT_PRIMITIVE_PARAMS: PrimitiveParams = {
  fill: "#9146ff",
  fillOpacity: 1,
  fillType: "solid",
  fillColor2: "#43e5e5",
  gradientAngle: 90,
  stroke: "transparent",
  strokeWidth: 0,
  cornerRadius: 0,
  opacity: 1,
  blendMode: "normal",
  shadow: false,
  shadowColor: "#000000",
  shadowBlur: 12,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  text: "Text",
  fontFamily: "",
  fontSize: 48,
  fontWeight: 700,
  textColor: "#ffffff",
  textAlign: "left",
  letterSpacing: 0,
  lineHeight: 1.2,
  textStroke: false,
  textStrokeColor: "#000000",
  textStrokeWidth: 2,
  imageDataUri: null,
  objectFit: "contain",
  objectPositionX: 50,
  objectPositionY: 50,
  iconId: "star",
  animationsEnabled: false,
  animationStyle: "pop",
};

/** One placed widget/shape inside a Canvas overlay — where it sits and how
 * big it is (percent of the canvas, not pixels, so it holds up across any
 * OBS Browser Source resolution), its rotation and stacking order, and
 * either `params` (a template widget) or `primitive` (a free-form shape),
 * per `kind`. */
export interface CanvasElementT {
  id: string;
  /** Absent/"template" = a pre-designed widget (`params`); anything else is
   * a free-form primitive (`primitive`). */
  kind?: ElementKind;
  /** Degrees, any kind. */
  rotation?: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  zIndex: number;
  /** Prevents drag/resize in the Canvas Maker — editor-only, has no effect on the rendered overlay. */
  locked?: boolean;
  /** Elements sharing a groupId move together when any one of them is dragged. */
  groupId?: string | null;
  /** Shared across every member of a group (kept in sync when set from the
   * inspector) — renders the whole group flattened behind one opacity
   * instead of each member fading independently, so overlapping members
   * don't double up where they cross. No effect on an ungrouped element. */
  groupOpacity?: number;
  /** Elements sharing a componentId are "linked" — a lighter, MANUAL-sync
   * alternative to a true live-linked component instance. Linking doesn't
   * change anything by itself; an explicit "sync" action copies one
   * instance's look/content (never its placement) onto every other member
   * sharing this id. Editing a member without syncing leaves the others
   * untouched, unlike a real Figma-style instance. */
  componentId?: string | null;
  /** When set and enabled, this element stays hidden in the rendered
   * overlay until a matching live alert (follow/sub/raid/cheer/tip) fires,
   * then animates in and auto-hides again after durationSeconds — the
   * element's placement/style is otherwise completely normal, this only
   * controls whether it starts hidden and what makes it appear. */
  alertTrigger?: AlertTrigger;
  /** Continuous, always-on animation independent of any entrance — applies
   * uniformly to ANY element kind (template or primitive) since it wraps
   * the element's content in its own inner div rather than touching the
   * element's own markup, which is also why it composes cleanly with the
   * element's own static rotation (a separate, outer transform) instead of
   * fighting it. "none"/absent = static. */
  loopAnimation?: "none" | "pulse" | "bounce" | "spin" | "glow";
  loopSpeedSeconds?: number;
  /** Level-based conditional visibility — visible for exactly as long as a
   * live value satisfies the condition (e.g. "viewers >= 50"), re-evaluated
   * every time /data-ws pushes an update. Distinct from alertTrigger, which
   * is momentary and event-driven rather than tied to a standing value. */
  valueCondition?: ValueCondition;
  /** Clips this element (any kind — template iframe or primitive) to a
   * shape via CSS clip-path, applied directly on the element's own
   * positioned wrapper since clip-path doesn't collide with anything else
   * that wrapper carries (transform, animation, opacity are all separate
   * properties). "none"/absent = full rectangular box, unclipped. */
  clipShape?: "none" | "circle" | "ellipse" | "rounded" | "diamond" | "hexagon" | "octagon";
  /** "rounded" only — corner radius as a percent of the box (0-50). */
  clipRoundedRadius?: number;
  /** Used when kind is "template" (or absent). Always present (even on a
   * primitive element, where it's an unused default) so any code path that
   * assumes every element has full params never has to null-check it. */
  params: TemplateParams;
  /** Used when kind is a primitive shape; absent/ignored for templates. */
  primitive?: PrimitiveParams;
}

export function elementKind(el: CanvasElementT): ElementKind {
  return el.kind ?? "template";
}

export function newCanvasElement(template: OverlayTemplateId, index: number): CanvasElementT {
  // Staggers new elements diagonally so they don't land exactly on top of
  // each other — purely a convenience for the first drag/nudge, not a
  // meaningful default.
  const offset = (index % 4) * 8;
  return {
    id: `el-${Date.now()}-${index}`,
    kind: "template",
    rotation: 0,
    xPct: 8 + offset,
    yPct: 8 + offset,
    widthPct: 32,
    heightPct: 22,
    zIndex: index,
    params: { ...DEFAULT_TEMPLATE_PARAMS, template },
  };
}

const PRIMITIVE_DEFAULT_SIZE: Record<Exclude<ElementKind, "template">, { w: number; h: number }> = {
  rect: { w: 24, h: 16 },
  ellipse: { w: 20, h: 20 },
  line: { w: 24, h: 0.6 },
  text: { w: 30, h: 8 },
  image: { w: 24, h: 24 },
  icon: { w: 10, h: 10 },
};

export function newPrimitiveElement(kind: Exclude<ElementKind, "template">, index: number): CanvasElementT {
  const offset = (index % 4) * 8;
  const size = PRIMITIVE_DEFAULT_SIZE[kind];
  return {
    id: `el-${Date.now()}-${index}`,
    kind,
    rotation: 0,
    xPct: 8 + offset,
    yPct: 8 + offset,
    widthPct: size.w,
    heightPct: size.h,
    zIndex: index,
    params: { ...DEFAULT_TEMPLATE_PARAMS },
    primitive: { ...DEFAULT_PRIMITIVE_PARAMS },
  };
}
