/**
 * DI tokens for the session module's outbound dependencies.
 * Adapters are wired in the composition root (app.module.ts).
 */
export const TASK_ACCESS_PORT = "SESSION_TASK_ACCESS_PORT";
export const TASK_LIFECYCLE_ACCESS_PORT = "SESSION_TASK_LIFECYCLE_ACCESS_PORT";
export const NOTIFICATION_PUBLISHER_PORT = "SESSION_NOTIFICATION_PUBLISHER_PORT";
