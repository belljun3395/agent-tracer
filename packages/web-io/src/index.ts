// @monitor/web-io — browser-boundary adapters for the web surface.
//
// This package wraps every failure-prone side effect (network, WebSocket,
// storage) behind typed adapters so upstream code never has to catch
// environment errors. Internals handle private-mode Storage, WebSocket
// construction failures, reconnect backoff, and unmount races.
//
// React-free. Consumed by web-state and web during the blackbox migration.
export { createSafeStorage } from "./storage.js";
export type {
    SafeStorage,
    StorageValidator,
    StorageWriteResult
} from "./storage.js";

export { MonitorSocket } from "./websocket.js";
export type {
    MonitorSocketOptions,
    MonitorSocketEventMap,
    MonitorSocketListener,
    MonitorSocketUnsubscribe
} from "./websocket.js";
