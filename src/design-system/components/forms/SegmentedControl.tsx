export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** SegmentedControl — glass button group for a small set of exclusive
 *  choices (view modes, layouts). Standalone version of the toggle embedded
 *  in the library search bar. */
export function SegmentedControl<T extends string = string>({ options, value, onChange, className = "" }: SegmentedControlProps<T>) {
  return (
    <div className={`bd-segmented ${className}`.trim()} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={opt.value === value ? "active" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon != null && <span>{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
