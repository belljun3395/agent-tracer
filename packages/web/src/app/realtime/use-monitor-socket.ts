import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { TaskId } from "~web/shared/identity.js";
import { MonitorSocket } from "~web/shared/api/realtime/connection.js";
import {
  parseRealtimeMessage,
  type MonitorRealtimeMessage,
} from "~web/app/realtime/messages.js";
import { syncMonitorCache } from "~web/app/realtime/sync-monitor-cache.js";

export interface UseMonitorSocketOptions {
  readonly url: string;
  readonly selectedTaskId?: TaskId | null;
  readonly onConnectionChange?: (connected: boolean) => void;
  readonly onMessage?: (message: MonitorRealtimeMessage) => void;
}

/** 모니터 소켓 생명주기를 React Query 캐시 동기화에 연결한다. */
export function useMonitorSocket(options: UseMonitorSocketOptions): void {
  const { url, selectedTaskId, onConnectionChange, onMessage } = options;
  const queryClient = useQueryClient();
  const selectedTaskIdRef = useRef<TaskId | null | undefined>(selectedTaskId);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
    onConnectionChangeRef.current = onConnectionChange;
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    const socket = new MonitorSocket({ url });
    let closed = false;

    const offConnection = socket.on("connectionChange", (connected) => {
      if (closed) return;
      if (connected) {
        void queryClient.invalidateQueries({ queryKey: ["monitor"] });
      }
      onConnectionChangeRef.current?.(connected);
    });
    const offMessage = socket.on("message", (raw) => {
      if (closed) return;
      const message = parseRealtimeMessage(raw);
      if (!message) return;
      syncMonitorCache(queryClient, message, selectedTaskIdRef.current ?? null);
      onMessageRef.current?.(message);
    });

    return () => {
      closed = true;
      offConnection();
      offMessage();
      socket.close();
    };
  }, [url, queryClient]);
}
