/** 규칙 생성 에이전트가 실행 중에 근거를 더 가져오는 도구의 명세이며 어댑터는 이것을 zod로 렌더링만 한다. */

export const RULEGEN_MCP_SERVER = "monitor-rule-gen";

export const RULEGEN_TOOL = {
    turns: "get_task_turns",
    events: "get_task_events",
    rules: "list_rules",
} as const;

export type RulegenToolName = (typeof RULEGEN_TOOL)[keyof typeof RULEGEN_TOOL];

export const RULEGEN_EVENT_LIMIT = {
    fallback: 50,
    min: 1,
    max: 100,
} as const;

/** 도구 인자 하나의 형태다. */
export interface RulegenToolParam {
    readonly name: "taskId" | "limit";
    readonly type: "string" | "integer";
    readonly optional: boolean;
    readonly description: string;
    readonly min?: number;
    readonly max?: number;
}

/** 도구 하나가 무엇을 조회하고 무슨 인자를 받는지에 대한 제품 지식이다. */
export interface RulegenToolSpec {
    readonly name: RulegenToolName;
    readonly description: string;
    readonly failureLabel: string;
    readonly params: readonly RulegenToolParam[];
}

const TASK_ID_PARAM: RulegenToolParam = {
    name: "taskId",
    type: "string",
    optional: false,
    description: "Task to pull evidence for.",
};

const LIMIT_PARAM: RulegenToolParam = {
    name: "limit",
    type: "integer",
    optional: true,
    description: `How many of the most recent events to return. Defaults to ${RULEGEN_EVENT_LIMIT.fallback}.`,
    min: RULEGEN_EVENT_LIMIT.min,
    max: RULEGEN_EVENT_LIMIT.max,
};

export const RULEGEN_TOOL_SPECS: readonly RulegenToolSpec[] = [
    {
        name: RULEGEN_TOOL.turns,
        description: "Get what the user asked in each turn of the task, chronologically. askedText is the user's own words, the primary source for rules and trigger phrases. assistantSummary is a short reply excerpt for context.",
        failureLabel: "Failed to fetch turns",
        params: [TASK_ID_PARAM],
    },
    {
        name: RULEGEN_TOOL.events,
        description: `Get the chronological event sequence for a task (tool calls, shell commands, file edits). Returns slim records (kind, title, body). Returns the most recent events up to the requested limit, default ${RULEGEN_EVENT_LIMIT.fallback}.`,
        failureLabel: "Failed to fetch events",
        params: [TASK_ID_PARAM, LIMIT_PARAM],
    },
    {
        name: RULEGEN_TOOL.rules,
        description: "List existing rules (name + trigger) to avoid duplicates.",
        failureLabel: "Failed to fetch rules",
        params: [],
    },
];

/** 모델이 부르는 도구의 정식 명칭은 mcp__<server>__<tool> 형식이다. */
export function rulegenToolFullName(name: RulegenToolName): string {
    return `mcp__${RULEGEN_MCP_SERVER}__${name}`;
}

export function rulegenToolSpec(name: RulegenToolName): RulegenToolSpec {
    const spec = RULEGEN_TOOL_SPECS.find((candidate) => candidate.name === name);
    if (spec === undefined) throw new Error(`unknown rule generation tool: ${name}`);
    return spec;
}

export function rulegenAllowedTools(specs: readonly RulegenToolSpec[]): string[] {
    return specs.map((spec) => rulegenToolFullName(spec.name));
}

/** 근거 조회가 HTTP로 실패해도 도구는 텍스트로 답해 모델이 다음 수를 두게 한다. */
export function rulegenToolFailureText(spec: RulegenToolSpec, status: number): string {
    return `${spec.failureLabel}: HTTP ${status}`;
}

/** 모델이 도구에 넘긴 인자다. */
export interface RulegenToolInput {
    readonly taskId: string;
    readonly limit?: number;
}

/** 도구 하나가 모델에게 돌려주는 텍스트를 만든다. */
export type RulegenToolHandler = (input: RulegenToolInput) => Promise<string>;

/** 실행기에 넘기는 도구 구현 묶음이다. */
export type RulegenToolset = Readonly<Record<RulegenToolName, RulegenToolHandler>>;

export function resolveEventLimit(limit: number | undefined): number {
    if (limit === undefined) return RULEGEN_EVENT_LIMIT.fallback;
    const bounded = Math.min(Math.max(Math.trunc(limit), RULEGEN_EVENT_LIMIT.min), RULEGEN_EVENT_LIMIT.max);
    return bounded;
}
