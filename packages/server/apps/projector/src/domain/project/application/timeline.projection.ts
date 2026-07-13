import { Injectable } from "@nestjs/common";
import type { NotificationEnvelope } from "@monitor/kernel";
import { TurnAssembly, type EventEntity, type TurnEntity } from "@monitor/tracer-domain";
import type { TimelineProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import { eventNotification } from "~projector/support/notification.factory.js";
import { buildEventEntity } from "~projector/support/event.fields.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

export interface TimelineResult {
    readonly event: EventEntity;
    readonly closedTurn: TurnEntity | null;
    readonly notifications: readonly NotificationEnvelope[];
}

/** 타임라인 이벤트를 저장하고 대화 흐름에서 턴을 조립한다. */
@Injectable()
export class TimelineProjection {
    async project(
        repositories: TimelineProjectionRepositories,
        record: LedgerRecord,
        assemble: boolean,
    ): Promise<TimelineResult> {
        const event = buildEventEntity(record);
        let closedTurn: TurnEntity | null = null;

        if (assemble && record.sessionId !== null) {
            const existing = await repositories.findEventById(event.id);
            // Kafka 재전달로 같은 이벤트가 다시 도착해도 이미 부여된 턴을 그대로 유지한다.
            if (existing !== null && existing.turnId !== null) {
                event.attachToTurn(existing.turnId);
            } else {
                const commentaryTurnId = await this.resolveCommentaryTurn(repositories, event);
                const originTurnId = commentaryTurnId ?? await this.resolveAsyncOriginTurn(repositories, event);
                if (originTurnId !== null) {
                    event.attachToTurn(originTurnId);
                } else {
                    closedTurn = await this.assemble(repositories, record.sessionId, event);
                }
            }
        }

        await repositories.events.upsertAll([event]);
        return { event, closedTurn, notifications: [eventNotification(record.userId, event)] };
    }

    private async resolveCommentaryTurn(
        repositories: TimelineProjectionRepositories,
        event: EventEntity,
    ): Promise<string | null> {
        if (!event.isAssistantCommentary()) return null;
        const responseEventId = event.turnResponseEventId();
        if (responseEventId === null || responseEventId === event.id) return null;
        const parent = await repositories.findEventById(responseEventId);
        if (parent === null || !parent.isAssistantResponse()
            || parent.taskId !== event.taskId || parent.sessionId !== event.sessionId) return null;
        return parent.turnId;
    }

    private async resolveAsyncOriginTurn(
        repositories: TimelineProjectionRepositories,
        event: EventEntity,
    ): Promise<string | null> {
        const asyncTaskId = event.asyncTaskId();
        if (asyncTaskId === null || event.isAsyncActionRunning()) return null;
        const origin = await repositories.findRunningAsyncAction(event.taskId, asyncTaskId);
        return origin?.turnId ?? null;
    }

    private async assemble(
        repositories: TimelineProjectionRepositories,
        sessionId: string,
        event: EventEntity,
    ): Promise<TurnEntity | null> {
        const openTurn = await repositories.turns.findOpenBySession(sessionId);
        const lastIndex = await repositories.turns.findLastIndex(sessionId);
        const mutation = new TurnAssembly(openTurn, lastIndex).apply(event);

        if (mutation.action === "open") {
            event.attachToTurn(mutation.turn.id);
            await repositories.turns.upsert(mutation.turn);
            if (openTurn !== null) await repositories.turns.upsert(openTurn);
            return null;
        }
        if (mutation.action === "close") {
            event.attachToTurn(mutation.turn.id);
            await repositories.turns.upsert(mutation.turn);
            return mutation.turn;
        }
        if (mutation.action === "attach") {
            event.attachToTurn(mutation.turnId);
        }
        return null;
    }
}
