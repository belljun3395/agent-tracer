import * as crypto from "node:crypto";

/** 내용과 우선순위로 결정적 할 일 식별자를 만든다. */
export function stableTodoId(content: string, priority: string): string {
    return crypto.createHash("sha1").update(`${content}::${priority}`).digest("hex").slice(0, 16);
}
