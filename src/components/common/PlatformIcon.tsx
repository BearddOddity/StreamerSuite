import twitchPurple from "@/Icons/Twitch Purple.svg?raw";
import twitchBlack from "@/Icons/Twitch Black.svg?raw";
import twitchWhite from "@/Icons/Twitch White.svg?raw";
import kickGreen from "@/Icons/KICK Green.svg?raw";
import kickBlack from "@/Icons/KICK Black.svg?raw";
import kickWhite from "@/Icons/KICK White.svg?raw";
import joystickDark from "@/Icons/joysticktv-logo-simple-dark.svg?raw";
import joystickLight from "@/Icons/joysticktv-logo-simple-light.svg?raw";

export type IconSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
};

export type PlatformIconProps = {
  platform: "twitch" | "kick" | "joystick";
  size?: IconSize;
  variant?: "color" | "light" | "dark";
  className?: string;
};

export function PlatformIcon({ platform, size = "sm", variant = "color", className }: PlatformIconProps) {
  const src = getSrc(platform, variant);
  const px = sizeMap[size];
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className ?? ""}`}
      style={{ width: px, height: px }}
      dangerouslySetInnerHTML={{ __html: scopeAndScaleSvg(src, px) }}
    />
  );
}

export type ConnectionIconProps = {
  mode: "api" | "ws";
  size?: IconSize;
  className?: string;
};

export function ConnectionIcon({ mode, size = "sm", className }: ConnectionIconProps) {
  const px = sizeMap[size];
  if (mode === "ws") {
    return (
      <svg className={className} width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
      </svg>
    );
  }
  return (
    <svg className={className} width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function getSrc(platform: string, variant: string): string {
  if (platform === "twitch") {
    if (variant === "dark") return twitchBlack;
    if (variant === "light") return twitchWhite;
    return twitchPurple;
  }
  if (platform === "kick") {
    if (variant === "dark") return kickBlack;
    if (variant === "light") return kickWhite;
    return kickGreen;
  }
  if (platform === "joystick") {
    if (variant === "light") return joystickLight;
    return joystickDark;
  }
  return "";
}

/**
 * Scope SVG internal CSS classes and set rendering size.
 *
 * Multiple SVGs on the page reuse generic class names like .st0/.st1.
 * Without scoping, the last SVG's <style> wins and colors leak between icons.
 * We extract the <style> block, rename each class to a unique-prefixed version,
 * rename matching class="..." references, then drop the <style> into a scoped
 * container. Simpler approach: just inline the fills by replacing class refs
 * with the actual fill rules from <style>.
 */
function scopeAndScaleSvg(svgStr: string, size: number): string {
  // Extract <style> block
  const styleMatch = svgStr.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) {
    // No style block — just set dimensions
    return svgStr.replace(/<svg([^>]*)>/, `<svg$1 width="${size}" height="${size}">`);
  }

  const styleBlock = styleMatch[1];

  // Parse class -> fill mappings from the style block
  // Handles: .st0{fill:#FFFFFF;} and .st0 { fill: #FFFFFF; }
  const classFills: Record<string, string> = {};
  const classRegex = /\.([\w-]+)\s*\{[^}]*fill:\s*([#\w][^;}]*)/g;
  let m: RegExpExecArray | null;
  while ((m = classRegex.exec(styleBlock)) !== null) {
    classFills[m[1]] = m[2].trim();
  }

  let result = svgStr;

  // Replace class="st0" with inline fill="..." on each element
  result = result.replace(/class="([^"]+)"/g, (_match, classes) => {
    const classList = classes.split(/\s+/);
    const fills: string[] = [];
    const remaining: string[] = [];
    for (const cls of classList) {
      if (classFills[cls]) {
        fills.push(`fill="${classFills[cls]}"`);
      } else {
        remaining.push(cls);
      }
    }
    const attr = fills.join(" ");
    if (remaining.length > 0) {
      return `${attr} class="${remaining.join(" ")}"`;
    }
    return attr;
  });

  // Remove the <style> block entirely (fills are now inline)
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

  // Set dimensions
  result = result.replace(
    /<svg([^>]*)>/,
    `<svg$1 width="${size}" height="${size}">`
  );

  return result;
}
