/** Curated generic (non-trademarked) icon set for the "icon" primitive kind
 * — plain geometric glyphs (star, arrows, play/pause, etc.), each drawn with
 * `currentColor` so it recolors via the primitive's own `fill` field with no
 * icon-specific color logic needed. This exact SVG markup is mirrored in
 * `render_icon_svg` on the Rust side (src-tauri/src/overlay_manager.rs) —
 * the frontend only needs it to preview the picker and on-canvas box; the
 * actual overlay render always goes through the backend. */
export interface IconDef {
  id: string;
  label: string;
  /** Inner SVG markup, viewBox "0 0 24 24", using currentColor. */
  svg: string;
}

export const ICON_LIBRARY: IconDef[] = [
  {
    id: "star",
    label: "Star",
    svg: '<polygon points="12,2 14.35,8.76 21.51,8.91 15.8,13.24 17.88,20.09 12,16 6.12,20.09 8.2,13.24 2.49,8.91 9.65,8.76" fill="currentColor"/>',
  },
  {
    id: "heart",
    label: "Heart",
    svg: '<path d="M12,21.35 L10.55,20.03 C5.4,15.36 2,12.28 2,8.5 C2,5.42 4.42,3 7.5,3 C9.24,3 10.91,3.81 12,5.09 C13.09,3.81 14.76,3 16.5,3 C19.58,3 22,5.42 22,8.5 C22,12.28 18.6,15.36 13.45,20.04 L12,21.35 Z" fill="currentColor"/>',
  },
  {
    id: "bell",
    label: "Bell",
    svg: '<path d="M12,22 C13.1,22 14,21.1 14,20 L10,20 C10,21.1 10.89,22 12,22 Z M18,16 L18,11 C18,7.93 16.36,5.36 13.5,4.68 L13.5,4 C13.5,3.17 12.83,2.5 12,2.5 C11.17,2.5 10.5,3.17 10.5,4 L10.5,4.68 C7.63,5.36 6,7.92 6,11 L6,16 L4,18 L4,19 L20,19 L20,18 Z" fill="currentColor"/>',
  },
  {
    id: "play",
    label: "Play",
    svg: '<polygon points="6,3 20,12 6,21" fill="currentColor"/>',
  },
  {
    id: "pause",
    label: "Pause",
    svg: '<rect x="5" y="4" width="5" height="16" fill="currentColor"/><rect x="14" y="4" width="5" height="16" fill="currentColor"/>',
  },
  {
    id: "check",
    label: "Check",
    svg: '<polyline points="4,12 9,17 20,6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    id: "x",
    label: "X",
    svg: '<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "plus",
    label: "Plus",
    svg: '<line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "minus",
    label: "Minus",
    svg: '<line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "arrow-up",
    label: "Arrow Up",
    svg: '<polyline points="6,10 12,4 18,10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "arrow-down",
    label: "Arrow Down",
    svg: '<polyline points="6,14 12,20 18,14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "arrow-left",
    label: "Arrow Left",
    svg: '<polyline points="10,6 4,12 10,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "arrow-right",
    label: "Arrow Right",
    svg: '<polyline points="14,6 20,12 14,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  {
    id: "home",
    label: "Home",
    svg: '<polygon points="12,3 21,11 18,11 18,20 6,20 6,11 3,11" fill="currentColor"/>',
  },
  {
    id: "gear",
    label: "Settings",
    svg: '<polygon points="22,12 21.81,13.95 18.47,14.68 17.82,15.89 19.07,19.07 17.56,20.31 14.68,18.47 13.37,18.87 12,22 10.05,21.81 9.32,18.47 8.11,17.82 4.93,19.07 3.69,17.56 5.53,14.68 5.13,13.37 2,12 2.19,10.05 5.53,9.32 6.18,8.11 4.93,4.93 6.44,3.69 9.32,5.53 10.63,5.13 12,2 13.95,2.19 14.68,5.53 15.89,6.18 19.07,4.93 20.31,6.44 18.47,9.32 18.87,10.63" fill="currentColor"/>',
  },
  {
    id: "chat-bubble",
    label: "Chat",
    svg: '<path d="M4,4 H20 A2,2 0 0 1 22,6 V15 A2,2 0 0 1 20,17 H9 L4,21 V17 H4 A2,2 0 0 1 2,15 V6 A2,2 0 0 1 4,4 Z" fill="currentColor"/>',
  },
];

const FALLBACK_ICON = ICON_LIBRARY[0]!;

export function findIcon(id: string): IconDef {
  return ICON_LIBRARY.find((i) => i.id === id) ?? FALLBACK_ICON;
}
