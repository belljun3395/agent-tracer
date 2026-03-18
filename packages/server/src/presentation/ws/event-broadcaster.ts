/**
 * @module presentation/ws/event-broadcaster
 *
 * INotificationPublisher 구현 — WebSocket 클라이언트로 알림 브로드캐스트.
 */
import type WebSocket from "ws";
import type { INotificationPublisher, MonitorNotification } from "../../application/ports/index.js";

export class EventBroadcaster implements INotificationPublisher {
  private readonly clients = new Set<WebSocket>();

  addClient(ws: WebSocket): void { this.clients.add(ws); }
  removeClient(ws: WebSocket): void { this.clients.delete(ws); }

  publish(notification: MonitorNotification): void {
    const msg = JSON.stringify({ type: notification.type, payload: notification.payload });
    for (const client of this.clients) {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(msg);
      }
    }
  }
}
