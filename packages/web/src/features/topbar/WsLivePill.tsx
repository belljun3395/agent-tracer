import { Pill } from "~ui/index.js";
import { useTasksQuery } from "~state/server/queries.js";

interface WsLivePillProps {
  readonly connected: boolean;
}

/**
 * Tiny status pill — green dot + live task count when connected,
 * "Reconnecting…" while the websocket is down. The live count comes from
 * the cached tasks list, so this pill never triggers an extra fetch.
 */
export function WsLivePill({ connected }: WsLivePillProps) {
  const { data } = useTasksQuery();

  if (!connected) {
    return (
      <Pill tone="warn" dot pulse>
        Reconnecting…
      </Pill>
    );
  }

  const liveCount =
    data?.tasks.filter((t) => t.status === "running" || t.status === "waiting")
      .length ?? 0;

  return (
    <Pill tone="ok" dot pulse>
      WS · {liveCount} live
    </Pill>
  );
}
