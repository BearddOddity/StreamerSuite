export interface OverlayEntry {
  file: string;
  name: string;
}

export type OverlayTemplateId = "lower-third" | "corner-badge" | "ticker" | "text-box";

export interface TemplateDef {
  id: OverlayTemplateId;
  label: string;
  icon: string;
  description: string;
  positions: { value: string; label: string }[];
  hasSpeed?: boolean;
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
    description: "Small pill badge, e.g. a follow goal or now-playing tag",
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
];

/** Live values other StreamerSuite tools publish via overlay_publish_data. */
export const LIVE_SOURCES: { value: string; label: string }[] = [
  { value: "", label: "Static text" },
  { value: "viewers", label: "Viewers (Stream Stats)" },
  { value: "followers", label: "Followers (Stream Stats)" },
  { value: "subscribers", label: "Subscribers (Stream Stats)" },
  { value: "uptime", label: "Stream Uptime (Stream Stats)" },
  { value: "timer", label: "Timer (Stream Timer)" },
];

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
  borderRadius: "sharp" | "soft" | "rounded";
  animationsEnabled: boolean;
}

export const DEFAULT_TEMPLATE_PARAMS: TemplateParams = {
  template: "lower-third",
  title: { text: "Now Playing", source: "" },
  subtitle: { text: "", source: "" },
  textColor: "#ffffff",
  accentColor: "#9146ff",
  bgOpacity: 0.85,
  position: "bottom-left",
  logoDataUri: null,
  speedSeconds: 18,
  fontFamily: "",
  borderRadius: "rounded",
  animationsEnabled: true,
};
