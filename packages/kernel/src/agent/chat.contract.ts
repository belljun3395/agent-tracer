/** chat 에이전트가 대화 턴에서 여는 도구 표면의 계약 상수와 타입이며, 값은 옆의 __fixtures__/chat.tool.contract.json이 소유하고 두 실행 백엔드가 그 파일을 읽는다. */

/** 모델에게 여는 도구의 프로그램 이름과 와이어 이름의 대응이다. */
export const CHAT_TOOL = {
    searchTasks: "search_tasks",
    getTask: "get_task",
    getTimeline: "get_timeline",
    searchEvents: "search_events",
    listMemos: "list_memos",
    listRules: "list_rules",
    getRuleEvidence: "get_rule_evidence",
    listTags: "list_tags",
    listRecipes: "list_recipes",
    listCleanupSuggestions: "list_cleanup_suggestions",
    getJob: "get_job",
    listSettings: "list_settings",
} as const;

export type ChatToolName = (typeof CHAT_TOOL)[keyof typeof CHAT_TOOL];

/** 계약 픽스처의 tools 키와 바이트 단위로 같아야 하는, 이 에이전트의 전체 도구 이름이다. */
export const CHAT_TOOLS: readonly ChatToolName[] = Object.values(CHAT_TOOL);

/** 사용자에게 쓰기 확인 게이트를 세워야 하는 mutation 도구의 이름이며, 읽기 전용인 Phase 2에서는 비어 있고 쓰기 도구가 들어오는 이후 단계가 픽스처의 tools[*].mutation과 함께 채운다. */
export const CHAT_MUTATION_TOOLS: readonly ChatToolName[] = [];

/** 수치 인자의 기본값과 상하한이다. */
export interface ChatToolArgNumber {
    readonly default: number;
    readonly min: number;
    readonly max: number;
}

/** 열거 인자의 허용값과, 있으면 기본값이다. */
export interface ChatToolArgEnum {
    readonly default?: string;
    readonly values: readonly string[];
}

export type ChatToolArgSpec = ChatToolArgNumber | ChatToolArgEnum;

/** 한 도구의 계약이며, required·optional·mutation은 예약된 키이고 그 밖의 키는 required나 optional에 이름을 올린 인자의 제약(ChatToolArgSpec)이다. */
export type ChatToolSpec = {
    readonly required: readonly string[];
    readonly optional: readonly string[];
    readonly mutation: boolean;
} & {
    readonly [arg: string]: readonly string[] | boolean | ChatToolArgSpec;
};

export interface ChatToolContract {
    readonly maxTurns: number;
    readonly limits: {
        readonly maxOutputTokens: number;
        readonly maxBudgetUsd: number;
    };
    readonly tools: Readonly<Record<string, ChatToolSpec>>;
    readonly responses: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
    readonly descriptions: Readonly<Record<string, string>>;
}

const RESERVED_TOOL_KEYS = new Set(["required", "optional", "mutation"]);

/** required·optional·mutation을 뺀 나머지 키로 도구의 인자 이름과 그 제약을 뽑아낸다. */
export function chatToolArgSpecs(spec: ChatToolSpec): ReadonlyMap<string, ChatToolArgSpec> {
    const args = new Map<string, ChatToolArgSpec>();
    for (const [key, value] of Object.entries(spec)) {
        if (!RESERVED_TOOL_KEYS.has(key)) {
            args.set(key, value as ChatToolArgSpec);
        }
    }
    return args;
}
