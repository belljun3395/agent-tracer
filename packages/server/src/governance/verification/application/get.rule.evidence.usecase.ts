import type { ITimelineEventRead } from "~activity/event/public/iservice/timeline.event.read.iservice.js";
import type { TimelineEventSnapshot } from "~activity/event/public/dto/timeline.event.dto.js";
import type { IRuleRead } from "~governance/rule/public/iservice/rule.read.iservice.js";
import type { RuleSnapshot } from "~governance/rule/public/dto/rule.snapshot.dto.js";
import type { IRuleEnforcementRepository } from "./outbound/rule.enforcement.repository.port.js";
import type {
    GetRuleEvidenceForTaskUseCaseIn,
    GetRuleEvidenceForTaskUseCaseOut,
    RuleEvidenceEventDto,
    RuleMatchedBy,
} from "./dto/get.rule.evidence.usecase.dto.js";

/**
 * Reads `rule_enforcements` for a rule, intersects with events of the given
 * task, and returns evidence rows grouped by matchKind (trigger / expect).
 *
 * Each row carries `matchedBy` — the rule conditions that fired
 * ("action" / "commandMatch" / "pattern" / "trigger-phrase"). Since the
 * matching engine ANDs all expect conditions, the label set equals the set
 * of conditions configured on the rule. Useful for spotting too-loose or
 * too-tight matchers at a glance.
 *
 * Triggers without a corresponding expect on this task get `unfulfilled: true`
 * so the UI can render a ⚠ "agent triggered but didn't follow through".
 */
export class GetRuleEvidenceForTaskUseCase {
    constructor(
        private readonly enforcementRepo: IRuleEnforcementRepository,
        private readonly eventRead: ITimelineEventRead,
        private readonly ruleRead: IRuleRead,
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
            if (!ev) continue; // enforcement event not in this task — skip
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

        // Mark triggers as unfulfilled when no expect landed after them.
        // Simple heuristic: any expect existing on the task means the rule
        // "fulfilled" globally. Per-turn fulfillment would require the
        // verdict layer — defer until we surface verdicts inline.
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

function listExpectConditions(rule: RuleSnapshot): readonly RuleMatchedBy[] {
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
    if (ev.kind === "terminal.command") return "Bash";
    return undefined;
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max) + "…";
}
