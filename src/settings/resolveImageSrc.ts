import { convertFileSrc } from "@tauri-apps/api/core";

// Wallpaper/background fields accept a direct image URL or a local file
// path. A raw path can't be used as a CSS url()/<img src> though — it needs
// Tauri's asset protocol — so anything that isn't a scheme this app
// actually serves images over goes through convertFileSrc() instead of
// being used as-is. Parsed with the URL constructor (not a regex) so a
// scheme is only ever accepted when it's genuinely the URL's protocol, and
// anything that isn't a well-formed absolute URL at all (a bare filesystem
// path, which is the common case after picking a wallpaper file) falls
// through to convertFileSrc() too. Mirrors statusforge/utils/imageSrc.ts.
const ALLOWED_IMAGE_PROTOCOLS = new Set(["http:", "https:", "asset:", "data:"]);

export function resolveImageSrc(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    if (ALLOWED_IMAGE_PROTOCOLS.has(new URL(trimmed).protocol)) return trimmed;
  } catch {
    // Not a well-formed absolute URL — treat it as a local path below.
  }
  return convertFileSrc(trimmed);
}
