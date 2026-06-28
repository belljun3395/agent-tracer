import type { SessionStatus } from "../public/dto/session.snapshot.dto.js";

export const RUNNING_SESSION_STATUS = "running" as const satisfies SessionStatus;

export function isRunningSession(session: { readonly status: SessionStatus }): boolean {
    return session.status === RUNNING_SESSION_STATUS;
}
