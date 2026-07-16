import { MEMO_AUTHORS } from "@monitor/kernel";
import type { MemoAuthor } from "~web/entities/memo/model/memo.js";
import { Input, Select } from "~web/shared/ui/index.js";

export type AuthorFilter = "all" | MemoAuthor;

const AUTHOR_OPTIONS: ReadonlyArray<{ readonly value: AuthorFilter; readonly label: string }> = [
  { value: "all", label: "Any author" },
  ...MEMO_AUTHORS.map((author) => ({ value: author, label: author })),
];

interface MemoFilterBarProps {
  readonly author: AuthorFilter;
  readonly onAuthorChange: (next: AuthorFilter) => void;
  readonly search: string;
  readonly onSearchChange: (next: string) => void;
}

export function MemoFilterBar({
  author,
  onAuthorChange,
  search,
  onSearchChange,
}: MemoFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={author}
        onChange={(e) => onAuthorChange(e.target.value as AuthorFilter)}
        className="text-[11.5px] text-ink-muted bg-s1 py-[5px]"
      >
        {AUTHOR_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <span className="flex-1 min-w-[120px]" />
      <Input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search memo body…"
        className="w-[220px] text-[11.5px] py-[5px]"
      />
    </div>
  );
}
