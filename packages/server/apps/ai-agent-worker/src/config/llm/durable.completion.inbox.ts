import { createHash, randomBytes } from "node:crypto";
import {
    AgentCompletionInboxEntity,
    COMPLETION_INBOX_STATUS,
    type CompletionInboxStatus,
} from "@monitor/tracer-domain";
import type { AgentCompletionInboxRepository } from "@monitor/tracer-domain";

export { COMPLETION_INBOX_STATUS } from "@monitor/tracer-domain";

export interface CompletionGrant {
    readonly url: string;
    readonly token: string;
}

export interface CompletionInbox {
    open(runKey: string, deadlineMs: number): Promise<{ readonly grant: CompletionGrant | null; readonly entry: CompletionInboxEntry }>;
    find(runKey: string): Promise<CompletionInboxEntry | null>;
    accept(token: string, response: Record<string, unknown>): Promise<"accepted" | "duplicate" | "closed" | "unknown">;
    close(runKey: string, status: "canceled" | "expired"): Promise<void>;
}

export interface CompletionInboxEntry {
    readonly status: CompletionInboxStatus;
    readonly response: Record<string, unknown> | null;
}

/** DB inbox는 callback 결과를 먼저 보관하고, 어느 worker든 run key로 다시 회수하게 한다. */
export class DurableCompletionInbox implements CompletionInbox {
    constructor(
        private readonly callbacksUrl: string,
        private readonly repository: AgentCompletionInboxRepository,
        private readonly now: () => Date = () => new Date(),
    ) {}

    async open(runKey: string, deadlineMs: number): Promise<{ grant: CompletionGrant | null; entry: CompletionInboxEntry }> {
        const existing = await this.repository.findByRunKey(runKey);
        if (existing !== null) return { grant: null, entry: await this.expireIfNeeded(existing) };

        const now = this.now();
        const token = randomBytes(32).toString("base64url");
        const inserted = await this.repository.insert(
            AgentCompletionInboxEntity.open(runKey, tokenHash(token), now, new Date(now.getTime() + deadlineMs)),
        );
        if (inserted) {
            return {
                grant: { url: new URL("/runs/complete", this.callbacksUrl).toString(), token },
                entry: { status: COMPLETION_INBOX_STATUS.pending, response: null },
            };
        }

        const raced = await this.repository.findByRunKey(runKey);
        if (raced === null) throw new Error("completion inbox insert lost without an entry");
        return { grant: null, entry: await this.expireIfNeeded(raced) };
    }

    async find(runKey: string): Promise<CompletionInboxEntry | null> {
        const entry = await this.repository.findByRunKey(runKey);
        return entry === null ? null : this.expireIfNeeded(entry);
    }

    async accept(token: string, response: Record<string, unknown>): Promise<"accepted" | "duplicate" | "closed" | "unknown"> {
        return this.repository.accept(tokenHash(token), response, this.now());
    }

    async close(runKey: string, status: "canceled" | "expired"): Promise<void> {
        await this.repository.closePending(runKey, status, this.now());
    }

    private async expireIfNeeded(entry: AgentCompletionInboxEntity): Promise<CompletionInboxEntry> {
        if (entry.status !== COMPLETION_INBOX_STATUS.pending || entry.expiresAt.getTime() > this.now().getTime()) {
            return entryOf(entry);
        }
        await this.repository.closePending(entry.runKey, "expired", this.now());
        return { status: COMPLETION_INBOX_STATUS.expired, response: null };
    }
}

function entryOf(entry: AgentCompletionInboxEntity): CompletionInboxEntry {
    return { status: entry.status, response: entry.response };
}

function tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}
