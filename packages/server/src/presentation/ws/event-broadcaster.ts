import type WebSocket from "ws";
import type { INotificationPublisher, MonitorNotification } from "@monitor/application";
export class EventBroadcaster implements INotificationPublisher {
    private readonly clients = new Set<WebSocket>();
    addClient(ws: WebSocket): void { this.clients.add(ws); }
    removeClient(ws: WebSocket): void { this.clients.delete(ws); }
    publish(notification: MonitorNotification): void {
        const msg = JSON.stringify({ type: notification.type, payload: notification.payload });
        for (const client of this.clients) {
            if (client.readyState === 1) {
                client.send(msg);
            }
        }
    }
}
