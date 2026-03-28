import { HTMLAttributes } from "react";

interface SectionLabelProps extends HTMLAttributes<HTMLParagraphElement> {
  number?: string;
}

export function SectionLabel({ number, className = "", children, ...props }: SectionLabelProps) {
  return (
    <p
      className={[
        "text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]",
        className,
      ].join(" ")}
      {...props}
    >
      {number && (
        <span className="text-[10px] font-medium text-primary-blue mr-1.5">{number}</span>
      )}
      {children}
    </p>
  );
}
