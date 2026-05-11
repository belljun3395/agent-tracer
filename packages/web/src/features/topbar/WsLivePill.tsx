import { Pill, Tooltip } from "~ui/index.js";
import { useTasksQuery } from "~state/server/queries.js";

interface WsLivePillProps {
  readonly connected: boolean;
}

/**
 * Two adjacent pills instead of one — the connection state and the live
 * task count are independent metrics, so we render them separately:
 *
 *   • WS pill   — connection-only ("WS" / "Reconnecting…")
 *   • Live pill — count of running + waiting tasks (hidden when zero)
 *
 * The previous combined "WS · 11 live" pill conflated the two, leaving
 * users to guess whether the number was message count or task count.
 */
export function WsLivePill({ connected }: WsLivePillProps) {
  const { data } = useTasksQuery();

  if (!connected) {
    return (
      <Tooltip
        content="The dashboard isn't receiving websocket events. Updates will resume once the monitor server comes back."
        side="bottom"
      >
        <span>
          <Pill tone="warn" dot pulse>
            Reconnecting…
          </Pill>
        </span>
      </Tooltip>
    );
  }

  const liveCount =
    data?.tasks.filter((t) => t.status === "running" || t.status === "waiting")
      .length ?? 0;

  return (
    <>
      <Tooltip
        content="Connected to the monitor websocket — task and event updates are streaming in real time."
        side="bottom"
      >
        <span>
          <Pill tone="ok" dot pulse>
            WS
          </Pill>
        </span>
      </Tooltip>
      {liveCount > 0 && (
        <Tooltip
          content={`${liveCount} task${liveCount === 1 ? "" : "s"} currently running or waiting for input.`}
          side="bottom"
        >
          <span>
            <Pill tone="neutral">{liveCount} live</Pill>
          </span>
        </Tooltip>
      )}
    </>
  );
}
