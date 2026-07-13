import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { TaskId } from "~web/shared/identity.js";
import type { MonitorRealtimeMessage } from "~web/app/realtime/messages.js";
import { useMonitorSocket } from "~web/app/realtime/use-monitor-socket.js";

const socketState = vi.hoisted(() => ({
  instances: [] as Array<{
    readonly url: string;
    readonly listeners: Map<string, (payload: unknown) => void>;
    readonly close: ReturnType<typeof vi.fn>;
  }>,
}));
const syncMonitorCache = vi.hoisted(() => vi.fn());

vi.mock("~web/shared/api/realtime/connection.js", () => ({
  MonitorSocket: class {
    readonly listeners = new Map<string, (payload: unknown) => void>();
    readonly close = vi.fn();

    constructor({ url }: { readonly url: string }) {
      socketState.instances.push({ url, listeners: this.listeners, close: this.close });
    }

    on(event: string, listener: (payload: unknown) => void) {
      this.listeners.set(event, listener);
      return () => this.listeners.delete(event);
    }
  },
}));

vi.mock("./sync-monitor-cache.js", () => ({ syncMonitorCache }));

describe("useMonitorSocket", () => {
  it("선택 태스크와 콜백 변경은 재접속 없이 최신 값으로 전달한다", () => {
    socketState.instances.length = 0;
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const onMessage = vi.fn();
    const firstTaskId = TaskId("task-1");
    const secondTaskId = TaskId("task-2");

    const { rerender, unmount } = render(
      <Probe client={client} taskId={firstTaskId} onMessage={onMessage} />,
    );
    rerender(<Probe client={client} taskId={secondTaskId} onMessage={onMessage} />);

    expect(socketState.instances).toHaveLength(1);
    const socket = socketState.instances[0]!;
    act(() => socket.listeners.get("connectionChange")?.(true));
    act(() => socket.listeners.get("message")?.(
      '{"type":"tasks.purged","payload":{"count":1}}',
    ));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["monitor"] });
    expect(syncMonitorCache).toHaveBeenCalledWith(
      client,
      { type: "tasks.purged", payload: { count: 1 } },
      secondTaskId,
    );
    expect(onMessage).toHaveBeenCalledWith({
      type: "tasks.purged",
      payload: { count: 1 },
    });

    unmount();
    expect(socket.close).toHaveBeenCalledOnce();
  });
});

function Probe({
  client,
  taskId,
  onMessage,
}: {
  readonly client: QueryClient;
  readonly taskId: TaskId;
  readonly onMessage: (message: MonitorRealtimeMessage) => void;
}) {
  return (
    <QueryClientProvider client={client}>
      <SocketConsumer taskId={taskId} onMessage={onMessage} />
    </QueryClientProvider>
  );
}

function SocketConsumer({
  taskId,
  onMessage,
}: {
  readonly taskId: TaskId;
  readonly onMessage: (message: MonitorRealtimeMessage) => void;
}) {
  useMonitorSocket({ url: "ws://monitor", selectedTaskId: taskId, onMessage });
  return null;
}
