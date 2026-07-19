import type { TagRecord } from "~web/entities/tag/model/tag.js";
import { readableForeground } from "~web/entities/tag/lib/tag-contrast.js";

interface TagChipProps {
  readonly tag: Pick<TagRecord, "id" | "name" | "color">;
  /** 지정하면 칩에 제거 버튼이 붙어 태스크 태그 피커의 선택된 태그 목록이 쓴다. */
  readonly onRemove?: () => void;
}

/** 태그 하나를 GitHub 라벨 스타일의 색 있는 알약으로 그린다. */
export function TagChip({ tag, onRemove }: TagChipProps) {
  const foreground = readableForeground(tag.color);

  return (
    <span
      title={tag.name}
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium leading-4 max-w-40"
      style={{ backgroundColor: tag.color, color: foreground }}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${tag.name}`}
          className="inline-flex items-center justify-center opacity-80 hover:opacity-100"
          style={{ color: foreground }}
        >
          ×
        </button>
      )}
    </span>
  );
}
