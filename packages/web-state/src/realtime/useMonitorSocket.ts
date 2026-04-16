import { TaskId } from "@monitor/core";
// eslint-disable-next-line no-restricted-imports -- legacy realtime parser pending move to web-io (plan S6/S7)
import { parseRealtimeMessage, type MonitorRealtimeMessage } from "@monitor/web-core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { monitorQueryKeys } from "../server/queryKeys.js";

export interface UseMonitorSocketOptions {
    readonly url: string;
    readonly selectedTaskId?: TaskId | null;
    readonly onConnectionChange?: (connected: boolean) => void;
    readonly onMessage?: (message: MonitorRealtimeMessage) => void;
}

export function useMonitorSocket(options: UseMonitorSocketOptions): void {
    const { url, selectedTaskId, onConnectionChange, onMessage } = options;
    const queryClient = useQueryClient();

    useEffect(() => {
        let socket: WebSocket | null = null;
        let closed = false;

        try {
            socket = new WebSocket(url);
        } catch {
            onConnectionChange?.(false);
            return;
        }

        socket.addEventListener("open", () => {
            if (!closed) onConnectionChange?.(true);
        });
        socket.addEventListener("close", () => {
            if (!closed) onConnectionChange?.(false);
        });
        socket.addEventListener("error", () => {
            if (!closed) onConnectionChange?.(false);
        });
        socket.addEventListener("message", (ev) => {
            if (closed) return;
            const message = parseRealtimeMessage(ev.data as string);
            if (!message) return;
            applyInvalidations(queryClient, message, selectedTaskId ?? null);
            onMessage?.(message);
        });

        return () => {
            closed = true;
            socket.close();
        };
    }, [url, queryClient, selectedTaskId, onConnectionChange, onMessage]);
}

function applyInvalidations(
    client: QueryClient,
    message: MonitorRealtimeMessage,
    selectedTaskId: TaskId | null
): void {
    switch (message.type) {
        case "snapshot":
        case "tasks.purged":
            void client.invalidateQueries({ queryKey: ["monitor"] });
            return;
        case "task.started":
        case "task.completed":
        case "task.updated": {
            void client.invalidateQueries({ queryKey: monitorQueryKeys.tasks() });
            void client.invalidateQueries({ queryKey: monitorQueryKeys.overview() });
            if (selectedTaskId && message.payload.id === selectedTaskId) {
                void client.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(selectedTaskId) });
            }
            return;
        }
        case "task.deleted": {
            void client.invalidateQueries({ queryKey: monitorQueryKeys.tasks() });
            void client.invalidateQueries({ queryKey: monitorQueryKeys.overview() });
            const deleted = TaskId(message.payload.taskId);
            client.removeQueries({ queryKey: monitorQueryKeys.taskDetail(deleted) });
            return;
        }
        case "event.logged":
        case "event.updated": {
            if (!selectedTaskId) return;
            void client.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(selectedTaskId) });
            return;
        }
        case "bookmark.saved":
        case "bookmark.deleted":
            void client.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() });
            return;
        case "session.started":
        case "session.ended":
            return;
    }
}
