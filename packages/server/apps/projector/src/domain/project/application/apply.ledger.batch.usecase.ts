import { Inject, Injectable } from "@nestjs/common";
import {
    CONVERSATION_EVENT_KINDS,
    KIND,
    NOTIFICATION_TYPE,
    RUN_EVENT_KINDS,
    TIMELINE_EVENT_KINDS,
    type NotificationEnvelope,
} from "@monitor/kernel";
import { AffinityProjection } from "~projector/domain/project/application/affinity.projection.js";
import { ArrivalProjection, type ArrivalCoalesced } from "~projector/domain/project/application/arrival.projection.js";
import { RecipeProjection } from "~projector/domain/project/application/recipe.projection.js";
import { RuleEvaluationProjection } from "~projector/domain/project/application/rule.evaluation.projection.js";
import { RunProjection } from "~projector/domain/project/application/run.projection.js";
import { TimelineProjection } from "~projector/domain/project/application/timeline.projection.js";
import {
    NOTIFICATION_PUBLISHER,
    type NotificationPublisherPort,
} from "~projector/domain/project/port/notification.publisher.port.js";
import type { LedgerProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import { TRACER_DATABASE, type TracerDatabase } from "~projector/domain/project/port/tracer.database.port.js";
import { taskNotification } from "~projector/support/notification.factory.js";
import { recordApplied } from "~projector/support/metrics.js";
import { logError } from "~projector/support/log.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

const RUN_KIND_SET = new Set<string>(RUN_EVENT_KINDS);
const CONVERSATION_KIND_SET = new Set<string>(CONVERSATION_EVENT_KINDS);
const TIMELINE_KIND_SET = new Set<string>(TIMELINE_EVENT_KINDS);

/** 원장 배치를 한 트랜잭션으로 투영하고, 커밋 뒤 알림과 계측을 발행하는 이 슬라이스의 유일한 진입점이다. */
@Injectable()
export class ApplyLedgerBatchUseCase {
    constructor(
        @Inject(TRACER_DATABASE) private readonly database: TracerDatabase,
        private readonly run: RunProjection,
        private readonly timeline: TimelineProjection,
        private readonly ruleEvaluation: RuleEvaluationProjection,
        private readonly recipe: RecipeProjection,
        private readonly affinity: AffinityProjection,
        private readonly arrival: ArrivalProjection,
        @Inject(NOTIFICATION_PUBLISHER) private readonly notifier: NotificationPublisherPort,
    ) {}

    async execute(records: Iterable<LedgerRecord>, recordProjected: () => Promise<void>): Promise<void> {
        const notifications: NotificationEnvelope[] = [];
        const applied: LedgerRecord[] = [];
        const arrivals = new Map<string, ArrivalCoalesced>();

        await this.database.withTransaction(async (repositories) => {
            for (const record of records) {
                notifications.push(...await this.projectRecord(repositories, record, arrivals));
                applied.push(record);
                await recordProjected();
            }
            const changedTasks = await this.arrival.projectBatch(repositories, arrivals);
            notifications.push(...changedTasks.map((task) => taskNotification(NOTIFICATION_TYPE.taskUpdated, task)));
        });

        for (const record of applied) recordApplied("db", record);
        for (const envelope of notifications) await this.notifier.publish(envelope);
    }

    private async projectRecord(
        repositories: LedgerProjectionRepositories,
        record: LedgerRecord,
        arrivals: Map<string, ArrivalCoalesced>,
    ): Promise<NotificationEnvelope[]> {
        const notifications = await this.dispatchByKind(repositories, record);
        this.arrival.merge(arrivals, record);
        return notifications;
    }

    private async dispatchByKind(
        repositories: LedgerProjectionRepositories,
        record: LedgerRecord,
    ): Promise<NotificationEnvelope[]> {
        const kind = record.kind;
        const notifications: NotificationEnvelope[] = [];

        if (RUN_KIND_SET.has(kind)) {
            notifications.push(...await this.run.project(repositories, record));
        } else if (kind === KIND.recipeInjected) {
            await this.recipe.projectInjected(repositories, record);
        } else if (kind === KIND.tokenUsage) {
            await this.timeline.project(repositories, record, false);
        } else if (CONVERSATION_KIND_SET.has(kind)) {
            const result = await this.timeline.project(repositories, record, true);
            notifications.push(...result.notifications);
            if (result.closedTurn !== null) {
                notifications.push(...await this.ruleEvaluation.project(
                    repositories,
                    result.closedTurn,
                    record.userId,
                    record.occurredAt,
                ));
            }
        } else if (TIMELINE_KIND_SET.has(kind)) {
            const result = await this.timeline.project(repositories, record, true);
            notifications.push(...result.notifications);
            if (kind === KIND.fileChanged) await this.affinity.project(repositories, record);
        } else {
            logError({ msg: "kind.unhandled", kind, taskId: record.taskId, eventId: record.id });
        }

        return notifications;
    }
}
