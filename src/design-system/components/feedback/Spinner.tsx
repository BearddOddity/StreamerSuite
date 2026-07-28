export interface SpinnerProps {
  size?: number;
  className?: string;
}

/** Spinner — bare rotating ring. Circular by convention (rotation reads
 *  wrong on a squircle); wrap in a glass box or use `SpinnerInline`/
 *  `SpinnerButton` markup for the common placements. */
export function Spinner({ size = 16, className = "" }: SpinnerProps) {
  return <span className={`bd-spinner ${className}`.trim()} style={{ width: size, height: size }} />;
}

export interface SpinnerBoxProps {
  className?: string;
}

/** SpinnerBox — Spinner inside a glass squircle icon container. */
export function SpinnerBox({ className = "" }: SpinnerBoxProps) {
  return (
    <div className={`bd-spinner-wrap ${className}`.trim()}>
      <Spinner />
    </div>
  );
}

export interface SpinnerInlineProps {
  children: string;
  className?: string;
}

/** SpinnerInline — Spinner + label in a glass pill, for "Scanning library…"-style status text. */
export function SpinnerInline({ children, className = "" }: SpinnerInlineProps) {
  return (
    <div className={`bd-spinner-inline ${className}`.trim()}>
      <Spinner size={13} />
      {children}
    </div>
  );
}
