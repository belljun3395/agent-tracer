import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";
import { KIND, TERMINAL_COMMAND_TOOL_NAME } from "@monitor/timeline-api/public/event/types/event.const.js";
import type { TimelineEventSnapshot } from "@monitor/timeline-api/public/event/dto/timeline.event.dto.js";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import type { RulePersistenceRecord } from "../rule/outbound/rule.persistence.port.js";
import type { IRuleEnforcementRepository } from "./outbound/rule.enforcement.repository.port.js";
import type {
    GetRuleEvidenceForTaskUseCaseIn,
    GetRuleEvidenceForTaskUseCaseOut,
    RuleEvidenceEventDto,
    RuleMatchedBy,
} from "./dto/get.rule.evidence.usecase.dto.js";

export class GetRuleEvidenceForTaskUseCase {
    constructor(
        private readonly enforcementRepo: IRuleEnforcementRepository,
        private readonly eventRead: ITimelineEventRead,
        private readonly ruleRead: RuleRepository,
    ) {}

    async execute(
        input: GetRuleEvidenceForTaskUseCaseIn,
    ): Promise<GetRuleEvidenceForTaskUseCaseOut> {
        const [enforcements, rule] = await Promise.all([
            this.enforcementRepo.findByRuleId(input.ruleId),
            this.ruleRead.findById(input.ruleId),
        ]);
        if (enforcements.length === 0) {
            return {
                taskId: input.taskId,
                ruleId: input.ruleId,
                triggers: [],
                expects: [],
            };
        }

        const expectConditions = rule ? listExpectConditions(rule) : [];
        const triggerLabels: readonly RuleMatchedBy[] =
            rule?.trigger && rule.trigger.phrases.length > 0
                ? (["trigger-phrase"] as const)
                : ([] as const);

        const eventIds = new Set(enforcements.map((e) => e.eventId));
        const events = await this.eventRead.findByTaskId(input.taskId);
        const byId = new Map<string, TimelineEventSnapshot>();
        for (const ev of events) {
            if (eventIds.has(ev.id)) byId.set(ev.id, ev);
        }

        const triggers: RuleEvidenceEventDto[] = [];
        const expects: RuleEvidenceEventDto[] = [];

        for (const enf of enforcements) {
            const ev = byId.get(enf.eventId);
            if (!ev) continue;
            const dto: RuleEvidenceEventDto = {
                eventId: ev.id,
                kind: ev.kind,
                title: ev.title,
                ...(ev.body ? { body: truncate(ev.body, 400) } : {}),
                ...(readString(ev.metadata, "command")
                    ? { command: truncate(readString(ev.metadata, "command")!, 200) }
                    : {}),
                ...(readPrimaryFilePath(ev)
                    ? { filePath: readPrimaryFilePath(ev)! }
                    : {}),
                ...(readToolName(ev) ? { toolName: readToolName(ev)! } : {}),
                decidedAt: enf.decidedAt,
                createdAt: ev.createdAt,
                matchKind: enf.matchKind,
                matchedBy: enf.matchKind === "trigger" ? triggerLabels : expectConditions,
            };
            if (enf.matchKind === "trigger") triggers.push(dto);
            else expects.push(dto);
        }

        triggers.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        expects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        const anyExpectsFulfilled = expects.length > 0;
        const triggersFinal = triggers.map((t) =>
            anyExpectsFulfilled ? t : { ...t, unfulfilled: true },
        );

        return {
            taskId: input.taskId,
            ruleId: input.ruleId,
            triggers: triggersFinal,
            expects,
        };
    }
}

function listExpectConditions(rule: RulePersistenceRecord): readonly RuleMatchedBy[] {
    const labels: RuleMatchedBy[] = [];
    if (rule.expect.action) labels.push("action");
    if (rule.expect.commandMatches && rule.expect.commandMatches.length > 0) {
        labels.push("commandMatch");
    }
    if (rule.expect.pattern) labels.push("pattern");
    return labels;
}

function readString(meta: Record<string, unknown>, key: string): string | undefined {
    const v = meta[key];
    return typeof v === "string" && v.trim() ? v : undefined;
}

function readPrimaryFilePath(ev: TimelineEventSnapshot): string | undefined {
    const direct = readString(ev.metadata, "filePath");
    if (direct) return direct;
    const arr = ev.metadata["filePaths"];
    if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
    return undefined;
}

function readToolName(ev: TimelineEventSnapshot): string | undefined {
    const explicit =
        readString(ev.metadata, "toolName") ?? readString(ev.metadata, "sourceTool");
    if (explicit) return explicit;
    if (ev.kind === KIND.terminalCommand) return TERMINAL_COMMAND_TOOL_NAME;
    return undefined;
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max) + "…";
}
