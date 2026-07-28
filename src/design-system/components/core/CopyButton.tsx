import { useRef, useState } from "react";

export interface CopyButtonProps {
  /** Text to copy to the clipboard. */
  value: string;
  /** Label shown at rest; swaps to "Copied!" for `resetAfterMs`. */
  label?: string;
  resetAfterMs?: number;
  onCopy?: () => void;
  className?: string;
}

/** CopyButton — glass button that copies `value` and shows a transient
 *  "Copied!" success state before reverting. */
export function CopyButton({ value, label = "Copy", resetAfterMs = 1600, onCopy, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard API unavailable — still show feedback, nothing else to do
    }
    onCopy?.();
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), resetAfterMs);
  };

  return (
    <button type="button" className={`bd-copy-btn ${copied ? "copied" : ""} ${className}`.trim()} onClick={handleClick}>
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
}
