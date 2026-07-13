import { cn } from "~web/shared/ui/lib/cn.js";

export function RuleMatchBadge({ count }: { readonly count: number }) {
  const fired = count > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-1.5 font-mono text-[10px] leading-4",
        fired
          ? "text-ink-tertiary bg-s2 border border-hair"
          : "text-ink-tertiary bg-transparent",
      )}
    >
      {fired ? `${count} evidence` : "—"}
    </span>
  );
}
