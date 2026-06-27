import { createHash } from "node:crypto";
import { DEFAULT_USER_ID } from "./user.context.js";

export function deriveUserId(email: string): string {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return DEFAULT_USER_ID;
    return `u_${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}
