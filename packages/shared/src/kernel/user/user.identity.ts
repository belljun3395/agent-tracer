import { createHash } from "node:crypto";
import { DEFAULT_USER_ID } from "./user.context.js";

/**
 * 이메일을 안정적인 userId 로 변환한다. 같은 이메일은 항상 같은 id 를 만든다
 * (정규화 후 해시). 빈 값이면 기본 사용자.
 */
export function deriveUserId(email: string): string {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return DEFAULT_USER_ID;
    return `u_${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}
