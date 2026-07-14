import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    RULE_EXPECTATION_KIND,
    aggregateVerdictStatus,
    type EnforcementRecord,
    type RuleEventMatchKind,
    type VerdictStatus,
} from "@monitor/kernel";
import type { EventEntity, RuleEntity, VerdictEntity } from "@monitor/tracer-domain";
import { RULE_EVENT_READER, type EventReaderPort } from "~tracer-api/domain/rule/port/event.reader.port.js";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import { RULE_TURN_REPOSITORY, type TurnRepositoryPort } from "~tracer-api/domain/rule/port/turn.repository.port.js";
import {
    RULE_VERDICT_REPOSITORY,
    type VerdictRepositoryPort,
} from "~tracer-api/domain/rule/port/verdict.repository.port.js";

export type RuleMatchedBy = "action" | "commandMatch" | "pattern" | "trigger-phrase";

export interface RuleEvidenceEventDto {
    readonly eventId: string;
    readonly kind: string;
    readonly title: string;
    readonly body?: string;
    readonly command?: string;
    readonly filePath?: string;
    readonly toolName?: string;
    readonly decidedAt: string;
    readonly createdAt: string;
    readonly matchKind: RuleEventMatchKind;
    readonly matchedBy: readonly RuleMatchedBy[];
    readonly unfulfilled?: boolean;
}

export interface RuleEvidenceResult {
    readonly taskId: string;
    readonly ruleId: string;
    /** anchor된 규칙에만 존재하는 근거 사용자 입력이다. */
    readonly anchorEventId: string | null;
    /** 판정된 적이 없으면 null인 이행 여부다. */
    readonly status: VerdictStatus | null;
    readonly triggers: readonly RuleEvidenceEventDto[];
    readonly expects: readonly RuleEvidenceEventDto[];
}

@Injectable()
export class GetRuleEvidenceUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        @Inject(RULE_TURN_REPOSITORY)
        private readonly turns: TurnRepositoryPort,
        @Inject(RULE_VERDICT_REPOSITORY)
        private readonly verdicts: VerdictRepositoryPort,
        @Inject(RULE_EVENT_READER)
        private readonly events: EventReaderPort,
    ) {}

    async execute(userId: string, ruleId: string, taskId?: string): Promise<RuleEvidenceResult> {
        const rule = await this.rules.findById(ruleId);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== userId) throw new NotFoundException("Rule not found");

        const scopeTaskId = taskId ?? rule.taskId ?? undefined;
        if (scopeTaskId === undefined) {
            return {
                taskId: "",
                ruleId,
                anchorEventId: rule.anchorEventId ?? null,
                status: null,
                triggers: [],
                expects: [],
            };
        }

        const turns = await this.turns.findByTask(scopeTaskId);
        const verdicts = await this.verdicts.findByRuleAndTurns(
            ruleId,
            turns.map((t) => t.id),
        );

        const records: { readonly record: EnforcementRecord; readonly verdict: VerdictEntity }[] = [];
        for (const verdict of verdicts) {
            for (const record of verdict.evidence.enforcements) {
                records.push({ record, verdict });
            }
        }

        const eventIds = [...new Set(records.map(({ record }) => record.eventId))];
        const events = await this.events.findByIds(eventIds);
        const eventById = new Map(events.map((e) => [e.id, e] as const));

        const triggers: RuleEvidenceEventDto[] = [];
        const expects: RuleEvidenceEventDto[] = [];
        for (const { record, verdict } of records) {
            const event = eventById.get(record.eventId);
            if (event === undefined) continue;
            const dto = toEvidenceEventDto(record, event, rule, verdict);
            if (record.matchKind === "trigger") triggers.push(dto);
            else expects.push(dto);
        }

        return {
            taskId: scopeTaskId,
            ruleId,
            anchorEventId: rule.anchorEventId ?? null,
            status: aggregateVerdictStatus(verdicts.map((verdict) => verdict.status)),
            triggers,
            expects,
        };
    }
}

function toEvidenceEventDto(
    record: EnforcementRecord,
    event: EventEntity,
    rule: RuleEntity,
    verdict: VerdictEntity,
): RuleEvidenceEventDto {
    const filePath = event.filePaths[0];
    const command = typeof event.metadata["command"] === "string" ? event.metadata["command"] : undefined;
    return {
        eventId: event.id,
        kind: event.kind,
        title: event.title,
        ...(event.body !== null ? { body: event.body } : {}),
        ...(command !== undefined ? { command } : {}),
        ...(filePath !== undefined ? { filePath } : {}),
        ...(event.toolName !== null ? { toolName: event.toolName } : {}),
        decidedAt: record.decidedAt,
        createdAt: event.occurredAt.toISOString(),
        matchKind: record.matchKind,
        matchedBy: matchedByFor(record, rule),
        ...(record.matchKind === "trigger" ? { unfulfilled: verdict.isContradicted() } : {}),
    };
}

function matchedByFor(record: EnforcementRecord, rule: RuleEntity): readonly RuleMatchedBy[] {
    if (record.matchKind === "trigger") return ["trigger-phrase"];
    switch (rule.expectation.kind) {
        case RULE_EXPECTATION_KIND.action:
            return ["action"];
        case RULE_EXPECTATION_KIND.command:
            return ["commandMatch"];
        case RULE_EXPECTATION_KIND.pattern:
            return ["pattern"];
    }
}
