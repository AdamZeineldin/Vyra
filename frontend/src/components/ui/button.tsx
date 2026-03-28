"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "warning";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary-blue text-white hover:bg-blue-700 border-transparent",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-secondary)] hover:bg-[var(--color-bg-secondary)]",
  warning:
    "bg-warning-bg text-warning-text border-warning-border hover:bg-red-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[10px] px-2 py-1",
  md: "text-[11px] px-3 py-1.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          "inline-flex items-center gap-1.5 font-medium rounded-btn border",
          "transition-colors duration-fast cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
