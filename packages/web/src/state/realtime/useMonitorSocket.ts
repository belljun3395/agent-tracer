import { TaskId } from "../../types.js";
import { MonitorSocket, parseRealtimeMessage, type MonitorRealtimeMessage } from "../../io.js";
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
        const socket = new MonitorSocket({ url });
        let closed = false;

        const offConnection = socket.on("connectionChange", (connected) => {
            if (!closed) {
                onConnectionChange?.(connected);
            }
        });
        const offMessage = socket.on("message", (raw) => {
            if (closed) {
                return;
            }
            const message = parseRealtimeMessage(raw);
            if (!message) return;
            applyMonitorRealtimeInvalidations(queryClient, message, selectedTaskId ?? null);
            onMessage?.(message);
        });

        return () => {
            closed = true;
            offConnection();
            offMessage();
            socket.close();
        };
    }, [url, queryClient, selectedTaskId, onConnectionChange, onMessage]);
}

export function applyMonitorRealtimeInvalidations(
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
                void client.invalidateQueries({ queryKey: monitorQueryKeys.taskObservability(selectedTaskId) });
            }
            return;
        }
        case "task.deleted": {
            void client.invalidateQueries({ queryKey: monitorQueryKeys.tasks() });
            void client.invalidateQueries({ queryKey: monitorQueryKeys.overview() });
            const deleted = TaskId(message.payload.taskId);
            client.removeQueries({ queryKey: monitorQueryKeys.taskDetail(deleted) });
            client.removeQueries({ queryKey: monitorQueryKeys.taskObservability(deleted) });
            return;
        }
        case "event.logged":
        case "event.updated": {
            if (!selectedTaskId) return;
            void client.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(selectedTaskId) });
            void client.invalidateQueries({ queryKey: monitorQueryKeys.taskObservability(selectedTaskId) });
            return;
        }
        case "bookmark.saved":
        case "bookmark.deleted":
            void client.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() });
            return;
        case "session.started":
        case "session.ended":
            if (!selectedTaskId || message.payload.taskId !== selectedTaskId) return;
            void client.invalidateQueries({ queryKey: monitorQueryKeys.taskObservability(selectedTaskId) });
            return;
    }
}
