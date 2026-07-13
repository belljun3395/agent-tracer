import { getMonitorWsUrl } from "~web/shared/api/realtime/monitor-ws-url.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";

interface TaskListFooterProps {
  /**
   * 보이는 모든 태스크가 같은 `runtimeSource`를 공유하면 패널이 이 값을
   * 내려줘, 필터 행을 복잡하게 만들지 않고 푸터에 은은한 캡션 하나로
   * (예: "all claude-plugin") 보여줄 수 있다.
   */
  readonly runtimeCaption?: string;
}

/** 스크롤되는 태스크 목록 아래 푸터. */
export function TaskListFooter({ runtimeCaption }: TaskListFooterProps) {
  const guidance = useGuidance();
  const host = safeHost(getMonitorWsUrl());

  return (
    <div className="flex items-center gap-2 border-t border-hair px-3.5 py-2 font-mono text-[10.5px] text-ink-tertiary">
      <span>WS {host}</span>
      {runtimeCaption && (
        <Tooltip
          content={
            <GuidanceText
              locale={guidance.locale}
              message={guidance.messages.tasks.runtimeCaption(runtimeCaption)}
            />
          }
        >
          <span>· all {runtimeCaption}</span>
        </Tooltip>
      )}
      <Tooltip
        content={
          <GuidanceText
            locale={guidance.locale}
            message={guidance.messages.tasks.shortcutsHint}
          />
        }
        side="top"
      >
        <button
          type="button"
          aria-label="Keyboard shortcuts (press ? key)"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "?", bubbles: true }),
            );
          }}
          className="ml-auto inline-flex items-center justify-center rounded-xs h-4 w-4 hover:bg-s1 border border-hair text-ink-tertiary cursor-help text-[9px] leading-none"
        >
          ?
        </button>
      </Tooltip>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
