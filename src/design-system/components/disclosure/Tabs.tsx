export interface TabDef {
  value: string;
  label: string;
}

export interface TabsProps {
  tabs: TabDef[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Tabs — the tab strip only; render the active panel yourself (see `.bd-tab-panel` for spacing). */
export function Tabs({ tabs, value, onChange, className = "" }: TabsProps) {
  return (
    <div className={`bd-tabs-list ${className}`.trim()} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          className={`bd-tab ${t.value === value ? "bd-tab-active" : ""}`.trim()}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
