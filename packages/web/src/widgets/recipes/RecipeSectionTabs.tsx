import { cn } from "~web/shared/ui/lib/cn.js";

export type RecipeSectionTab = "candidates" | "active" | "archive";

interface RecipeSectionTabsProps {
  readonly active: RecipeSectionTab;
  readonly onSelect: (tab: RecipeSectionTab) => void;
  readonly counts: { readonly candidates: number; readonly active: number; readonly archive: number };
}

export function RecipeSectionTabs({ active, onSelect, counts }: RecipeSectionTabsProps) {
  const tabs: ReadonlyArray<{
    readonly key: RecipeSectionTab;
    readonly label: string;
    readonly count: number;
  }> = [
    { key: "candidates", label: "Candidates", count: counts.candidates },
    { key: "active", label: "Active", count: counts.active },
    { key: "archive", label: "Archive", count: counts.archive },
  ];
  return (
    <div className="flex gap-1 pt-2 px-6 border-b border-hair bg-canvas">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          className={cn(
            "py-1.5 px-3 border-none bg-transparent text-[12.5px] cursor-pointer flex items-center gap-1.5 border-b-2",
            active === t.key
              ? "text-ink font-semibold border-primary"
              : "text-ink-muted font-medium border-transparent",
          )}
        >
          {t.label}
          <span className="font-mono text-[10px] px-1.5 rounded-pill bg-s1 text-ink-tertiary min-w-[18px] text-center">
            {t.count}
          </span>
        </button>
      ))}
    </div>
  );
}
