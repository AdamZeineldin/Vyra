"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ToastProps {
  message: string;
  variant?: "error" | "success";
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, variant = "error", onDismiss, durationMs = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const show = requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, durationMs);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = variant === "error";

  return (
    <div
      className={[
        "flex items-start gap-2.5 px-3 py-2.5 rounded-panel border shadow-lg max-w-sm w-full",
        "transition-all duration-smooth ease-smooth",
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95",
        isError
          ? "bg-[var(--color-bg-primary)] border-warning-border"
          : "bg-[var(--color-bg-primary)] border-[var(--color-border-primary)]",
      ].join(" ")}
    >
      {isError
        ? <AlertTriangle size={13} className="text-warning-text flex-shrink-0 mt-0.5" />
        : <CheckCircle2 size={13} className="text-diff-add-text flex-shrink-0 mt-0.5" />
      }
      <span className={`text-[12px] flex-1 leading-relaxed ${isError ? "text-warning-text" : "text-[var(--color-text-secondary)]"}`}>
        {message}
      </span>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] flex-shrink-0"
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {children}
    </div>
  );
}
