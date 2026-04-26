import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createRule,
    deleteRule,
    getRules,
    promoteRule,
    reEvaluateRule,
    updateRule,
    type BackfillResult,
    type CreateRuleInput,
    type GetRulesFilter,
    type PromoteRuleEdits,
    type UpdateRuleInput,
} from "../../../io/api.js";
import type { RuleRecord } from "../../../types.js";
import { monitorQueryKeys } from "../../../state/server/queryKeys.js";

interface UseRulesOptions {
    readonly taskId?: string;
}

const EMPTY: readonly RuleRecord[] = [];

/**
 * React-Query-backed rules cache. Mutations invalidate the rule list so
 * callers don't need to thread `refresh` through.
 *
 * `task` mode (`taskId` set) fetches global + that task's rules; the
 * `grouped.task` accessor still groups them so RulesContent can render
 * the same shape in both modes.
 */
export function useRules(options: UseRulesOptions = {}) {
    const { taskId } = options;
    const queryClient = useQueryClient();

    const filter: GetRulesFilter | undefined = taskId
        ? { scope: "task", taskId }
        : undefined;
    const queryKey = monitorQueryKeys.rules(filter as Record<string, string> | undefined);

    const query = useQuery({
        queryKey,
        queryFn: () => getRules(filter),
    });
    const rules: readonly RuleRecord[] = query.data?.rules ?? EMPTY;

    const grouped = useMemo(() => {
        const global: RuleRecord[] = [];
        const task: RuleRecord[] = [];
        for (const rule of rules) {
            if (rule.scope === "global") global.push(rule);
            else task.push(rule);
        }
        return { global, task };
    }, [rules]);

    function invalidateRules(): Promise<void> {
        return queryClient.invalidateQueries({ queryKey: ["monitor", "rules"] });
    }

    const createMutation = useMutation({
        mutationFn: (input: CreateRuleInput) => createRule(input),
        onSuccess: () => invalidateRules(),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, input }: { readonly id: string; readonly input: UpdateRuleInput }) =>
            updateRule(id, input),
        onSuccess: () => invalidateRules(),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteRule(id),
        onSuccess: () => invalidateRules(),
    });
    const promoteMutation = useMutation({
        mutationFn: ({ id, edits }: { readonly id: string; readonly edits: PromoteRuleEdits }) =>
            promoteRule(id, edits),
        onSuccess: () => invalidateRules(),
    });
    const reEvaluateMutation = useMutation({
        mutationFn: (id: string) => reEvaluateRule(id),
    });

    return {
        rules,
        global: grouped.global,
        task: grouped.task,
        refresh: invalidateRules,
        deleteRule: async (id: string) => {
            await deleteMutation.mutateAsync(id);
        },
        create: async (input: CreateRuleInput) => {
            await createMutation.mutateAsync(input);
        },
        update: async (id: string, input: UpdateRuleInput) => {
            await updateMutation.mutateAsync({ id, input });
        },
        promote: async (id: string, edits: PromoteRuleEdits) => {
            await promoteMutation.mutateAsync({ id, edits });
        },
        reEvaluate: async (id: string): Promise<BackfillResult> => {
            return reEvaluateMutation.mutateAsync(id);
        },
    };
}
