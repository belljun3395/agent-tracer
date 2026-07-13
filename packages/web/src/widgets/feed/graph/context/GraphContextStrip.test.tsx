import { KIND } from "@monitor/kernel";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventId, TaskId } from "~web/shared/identity.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { GraphContextStrip } from "~web/widgets/feed/graph/context/GraphContextStrip.js";

afterEach(cleanup);

describe("GraphContextStrip", () => {
  it("컨텍스트 추이와 모델 전환을 같은 시간축에 표시한다", () => {
    const store = createUiStore({ persisted: false });
    const { container } = render(
      <UiStoreProvider store={store}>
        <TooltipProvider>
          <GraphContextStrip
            events={[
              event("first", "2026-07-10T09:20:00.000Z", 50, "claude-sonnet-4"),
              event("last", "2026-07-10T09:21:00.000Z", 96, "claude-opus-4"),
            ]}
            range={{
              minMs: Date.parse("2026-07-10T09:20:00.000Z"),
              maxMs: Date.parse("2026-07-10T09:21:00.000Z"),
              spanMs: 60_000,
            }}
          />
        </TooltipProvider>
      </UiStoreProvider>,
    );

    expect(screen.getByText("96%")).not.toBeNull();
    expect(screen.getByText("Sonnet → Opus")).not.toBeNull();
    expect(container.querySelector('path[stroke="var(--err)"]')).not.toBeNull();
  });
});

function event(
  id: string,
  createdAt: string,
  percent: number,
  modelId: string,
): TimelineEventRecord {
  return {
    id: EventId(id),
    taskId: TaskId("task-1"),
    kind: KIND.tokenUsage,
    lane: "telemetry",
    title: "Token usage",
    metadata: {
      contextWindowUsedPct: percent,
      modelId,
    },
    classification: { lane: "telemetry", tags: [] },
    createdAt,
  };
}
