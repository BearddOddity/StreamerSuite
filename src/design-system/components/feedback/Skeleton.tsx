export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  className?: string;
}

/** Skeleton — shimmering loading placeholder. Set `circle` for avatar-shaped ones. */
export function Skeleton({ width = "100%", height = 16, radius, circle = false, className = "" }: SkeletonProps) {
  return (
    <div
      className={`bd-skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: circle ? "50%" : radius }}
    />
  );
}
