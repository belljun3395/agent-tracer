import type {
    IRuleRepository,
    RuleUpdateInput,
} from "~application/ports/repository/rule.repository.js";
import type { Rule, RuleExpectInput, RuleSeverity, RuleTriggerSource } from "~domain/verification/index.js";
import { isRuleExpectMeaningful } from "~domain/verification/index.js";

export class RuleNotFoundError extends Error {
    constructor(id: string) {
        super(`Rule ${id} not found`);
        this.name = "RuleNotFoundError";
    }
}

export class InvalidRuleUpdateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidRuleUpdateError";
    }
}

export interface UpdateRuleInput {
    readonly id: string;
    readonly name?: string;
    readonly trigger?: { readonly phrases: readonly string[] } | null;
    readonly triggerOn?: RuleTriggerSource | null;
    readonly expect?: {
        readonly tool?: string | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: RuleSeverity;
}

export interface UpdateRuleDeps {
    readonly ruleRepo: IRuleRepository;
}

function patchHasAnyField(input: UpdateRuleInput): boolean {
    return (
        input.name !== undefined ||
        input.trigger !== undefined ||
        input.triggerOn !== undefined ||
        input.expect !== undefined ||
        input.severity !== undefined
    );
}

/**
 * Apply the patch on top of `current` to produce the `expect` value that
 * would result from this update — used only to validate the post-update
 * shape (the actual update is sent as a partial patch to the repository).
 *
 * `null` in a patch field means "clear it"; `undefined` means "leave alone".
 */
function projectExpect(
    current: Rule["expect"],
    patch: UpdateRuleInput["expect"],
): RuleExpectInput {
    let tool: string | undefined = current.tool;
    let commandMatches: readonly string[] | undefined = current.commandMatches;
    let pattern: string | undefined = current.pattern;

    if (patch !== undefined) {
        if (patch.tool !== undefined) tool = patch.tool === null ? undefined : patch.tool;
        if (patch.commandMatches !== undefined) {
            commandMatches = patch.commandMatches === null ? undefined : patch.commandMatches;
        }
        if (patch.pattern !== undefined) pattern = patch.pattern === null ? undefined : patch.pattern;
    }

    return { tool, commandMatches, pattern };
}

export class UpdateRuleUseCase {
    constructor(private readonly deps: UpdateRuleDeps) {}

    async execute(input: UpdateRuleInput): Promise<Rule> {
        if (!patchHasAnyField(input)) {
            throw new InvalidRuleUpdateError("At least one field must be provided to update");
        }

        const current = await this.deps.ruleRepo.findById(input.id);
        if (!current) throw new RuleNotFoundError(input.id);

        const projected = projectExpect(current.expect, input.expect);
        if (!isRuleExpectMeaningful(projected)) {
            throw new InvalidRuleUpdateError(
                "Rule expect must include at least one of tool, pattern, or commandMatches after update",
            );
        }

        if (input.trigger != null && input.trigger.phrases.length === 0) {
            throw new InvalidRuleUpdateError("Trigger phrases must not be empty when trigger is provided");
        }

        if (input.name !== undefined && input.name.trim() === "") {
            throw new InvalidRuleUpdateError("Rule name must not be empty");
        }

        const patch: RuleUpdateInput = {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.severity !== undefined ? { severity: input.severity } : {}),
            ...(input.triggerOn !== undefined ? { triggerOn: input.triggerOn } : {}),
            ...(input.trigger !== undefined
                ? {
                    trigger: input.trigger === null
                        ? null
                        : { phrases: [...input.trigger.phrases] },
                }
                : {}),
            ...(input.expect !== undefined
                ? {
                    expect: {
                        ...(input.expect.tool !== undefined ? { tool: input.expect.tool } : {}),
                        ...(input.expect.commandMatches !== undefined
                            ? {
                                commandMatches: input.expect.commandMatches === null
                                    ? null
                                    : [...input.expect.commandMatches],
                            }
                            : {}),
                        ...(input.expect.pattern !== undefined ? { pattern: input.expect.pattern } : {}),
                    },
                }
                : {}),
        };

        const updated = await this.deps.ruleRepo.update(input.id, patch);
        if (!updated) throw new RuleNotFoundError(input.id);
        return updated;
    }
}
