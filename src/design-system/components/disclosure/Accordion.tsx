import { useState } from "react";
import type { ReactNode } from "react";

export interface AccordionItem {
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Title of the item open by default. Defaults to the first item. */
  defaultOpen?: string | null;
  className?: string;
}

/** Accordion — single-open-at-a-time collapsible list, keyed by item title. */
export function Accordion({ items, defaultOpen, className = "" }: AccordionProps) {
  const [open, setOpen] = useState<string | null | undefined>(defaultOpen ?? items[0]?.title);
  return (
    <div className={className}>
      {items.map((item) => {
        const isOpen = open === item.title;
        return (
          <div className="bd-accordion-item" data-open={isOpen} key={item.title}>
            <button className="bd-accordion-trigger" onClick={() => setOpen(isOpen ? null : item.title)}>
              <span>{item.title}</span>
              <svg className="bd-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="bd-accordion-panel">
              <div className="bd-accordion-panel-inner">{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
