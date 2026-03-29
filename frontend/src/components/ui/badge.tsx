import { HTMLAttributes } from "react";

type Variant = "winner" | "primary" | "warning" | "neutral" | "model";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
}

const variantClasses: Record<Variant, string> = {
  winner: "bg-winner-bg text-winner-text border border-winner",
  primary: "bg-primary-blue-bg text-primary-blue-text border border-primary-blue-border",
  warning: "bg-warning-bg text-warning-text border border-warning-border",
  neutral: "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-tertiary)]",
  model: "bg-[var(--color-bg-info)] text-[var(--color-text-info)] border border-[var(--color-border-info)]",
};

export function Badge({ variant = "neutral", dot, className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-pill animate-scale-in",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {dot && (
        <span
          className={[
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            variant === "winner" ? "bg-winner" : "bg-primary-blue",
          ].join(" ")}
        />
      )}
      {children}
    </span>
  );
}
