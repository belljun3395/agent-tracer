import { useTagsQuery } from "~web/entities/tag/api/queries.js";
import {
  useClearSidebarTagFilter,
  useGuidance,
  useSidebarTagFilter,
  useToggleSidebarTagFilter,
} from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

/** 사이드바 검색 아래에서 선택한 태그를 모두 가진 태스크만 남기며 태그가 없으면 렌더링하지 않는다. */
export function TaskListTagFilter() {
  const guidance = useGuidance();
  const { data } = useTagsQuery();
  const selected = useSidebarTagFilter();
  const toggle = useToggleSidebarTagFilter();
  const clear = useClearSidebarTagFilter();
  const tags = data?.tags ?? [];
  const selectedSet = new Set(selected);

  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-2.5 pb-1.5">
      <Tooltip
        content={<GuidanceText locale={guidance.locale} message={guidance.messages.tags.filterDescription} />}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary mr-0.5">
          Tags
        </span>
      </Tooltip>
      {tags.map((tag) => {
        const isOn = selectedSet.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            aria-pressed={isOn}
            className={cn(
              "inline-flex items-center gap-1 py-0.5 px-2 rounded-pill cursor-pointer transition-all duration-[120ms] border",
              "text-[10.5px] font-medium",
              isOn
                ? "border-hair-strong bg-s2 text-ink opacity-100"
                : "border-hair bg-transparent text-ink-tertiary opacity-70",
            )}
          >
            <span
              aria-hidden
              className={cn("w-[7px] h-[7px] rounded-full", isOn ? "opacity-100" : "opacity-40")}
              style={{ background: tag.color }}
            />
            {tag.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-[10.5px] text-ink-tertiary underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Clear
        </button>
      )}
    </div>
  );
}
