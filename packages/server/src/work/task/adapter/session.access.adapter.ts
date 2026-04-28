import { Inject, Injectable } from "@nestjs/common";
import { SESSION_LIFECYCLE } from "~activity/session/public/tokens.js";
import type { ISessionLifecycle } from "~activity/session/public/iservice/session.lifecycle.iservice.js";
import type {
    ISessionAccess,
    SessionAccessRecord,
    SessionAccessStatus,
    SessionCreateRequest,
} from "../application/outbound/session.access.port.js";

/**
 * Outbound adapter — bridges session module's public ISessionLifecycle to
 * the task-local ISessionAccess port.
 */
@Injectable()
export class SessionAccessAdapter implements ISessionAccess {
    constructor(
        @Inject(SESSION_LIFECYCLE) private readonly inner: ISessionLifecycle,
    ) {}

    async create(input: SessionCreateRequest): Promise<SessionAccessRecord> {
        const snapshot = await this.inner.create(input);
        return snapshot;
    }

    async findById(id: string): Promise<SessionAccessRecord | null> {
        return this.inner.findById(id);
    }

    async findActiveByTaskId(taskId: string): Promise<SessionAccessRecord | null> {
        return this.inner.findActiveByTaskId(taskId);
    }

    async updateStatus(
        id: string,
        status: SessionAccessStatus,
        endedAt: string,
        summary?: string,
    ): Promise<void> {
        return this.inner.updateStatus(id, status, endedAt, summary);
    }
}
