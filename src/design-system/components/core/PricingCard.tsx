import type { ReactNode } from "react";

export interface PricingCardProps {
  name: string;
  price: ReactNode;
  period?: string;
  features?: string[];
  /** Action slot — typically a Button. */
  action?: ReactNode;
  /** Purple-tinted border + glow for the recommended tier. */
  highlight?: boolean;
  className?: string;
  children?: ReactNode;
}

/** PricingCard — plan tile with a checklist and CTA slot. Set `highlight` on
 *  the recommended tier. */
export function PricingCard({
  name,
  price,
  period = "/mo",
  features = [],
  action,
  highlight = false,
  className = "",
  children,
}: PricingCardProps) {
  return (
    <div className={`bd-card bd-pricing-card ${highlight ? "bd-pricing-highlight" : ""} ${className}`.trim()}>
      <div className="bd-pricing-name">{name}</div>
      <div className="bd-pricing-amount">
        {price}
        <span>{period}</span>
      </div>
      <ul className="bd-pricing-list">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {action}
      {children}
    </div>
  );
}
