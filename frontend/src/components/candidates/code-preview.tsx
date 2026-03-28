interface CodePreviewProps {
  content: string;
  maxLines?: number;
  className?: string;
}

export function CodePreview({ content, maxLines = 8, className = "" }: CodePreviewProps) {
  const lines = content.split("\n").slice(0, maxLines);
  const truncated = content.split("\n").length > maxLines;

  return (
    <div
      className={[
        "bg-[var(--color-bg-secondary)] rounded-btn p-3 font-mono text-[11px] leading-relaxed overflow-hidden",
        className,
      ].join(" ")}
    >
      <pre className="text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre">
        {lines.join("\n")}
        {truncated && (
          <span className="text-[var(--color-text-tertiary)]">
            {"\n"}...{content.split("\n").length - maxLines} more lines
          </span>
        )}
      </pre>
    </div>
  );
}
