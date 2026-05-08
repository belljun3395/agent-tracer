interface TaskGroupHeaderProps {
  readonly label: string;
  readonly count: number;
}

/**
 * Uppercase eyebrow + count chip — separates Live/Today/Yesterday/Older bands
 * inside the scrollable task list.
 */
export function TaskGroupHeader({ label, count }: TaskGroupHeaderProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 pt-2.5 pb-1"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        color: "var(--ink-tertiary)",
      }}
    >
      <span>{label}</span>
      <span
        className="rounded-[var(--radius-xs)] bg-[var(--s1)] px-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ink-tertiary)",
          letterSpacing: 0,
          lineHeight: "16px",
        }}
      >
        {count}
      </span>
    </div>
  );
}
