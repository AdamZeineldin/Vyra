import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "winner" | "warning";
  padding?: "sm" | "md";
}

const variantClasses = {
  default: "bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)]",
  winner: "bg-[var(--color-bg-primary)] border-2 border-winner",
  warning: "bg-warning-bg border border-warning-border",
};

const paddingClasses = {
  sm: "p-3",
  md: "p-4",
};

export function Panel({ variant = "default", padding = "md", className = "", children, ...props }: PanelProps) {
  return (
    <div
      className={[
        "rounded-panel",
        variantClasses[variant],
        paddingClasses[padding],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
