import {
  useSidebarSearchQuery,
  useSetSidebarSearchQuery,
} from "~state/ui/index.js";

/**
 * Search input only for v1 — the v6 mock's "+ New observation ⌘N" button
 * is hidden because there's no manual-create endpoint yet (per plan's
 * "render only what backend supports" rule).
 */
export function TaskListHeader() {
  const value = useSidebarSearchQuery();
  const setValue = useSetSidebarSearchQuery();

  return (
    <label
      className="mx-3 mb-2 flex h-[30px] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hair)] bg-[var(--s1)] px-2.5 focus-within:border-[var(--primary-focus)] focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary-focus)_30%,transparent)]"
      style={{ color: "var(--ink-subtle)" }}
    >
      <SearchGlyph />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search tasks…"
        aria-label="Search tasks"
        className="flex-1 min-w-0 border-0 bg-transparent outline-0"
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 400,
          fontSize: 12.5,
          color: "var(--ink)",
          letterSpacing: "-0.05px",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
          style={{ fontSize: 14, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </label>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
