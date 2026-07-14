// tracer DB의 모든 테이블은 재생 가능한 투영이거나 소유 상태 둘 중 하나이며, 리빌드 커맨드는 이 분류 밖의 테이블을 건드리지 않는다.

// 원장에서 다시 만들어낼 수 있는 투영이며 리빌드가 통째로 지우고 재생성한다.
export const REBUILDABLE_TABLES = [
    "events",
    "tasks",
    "sessions",
    "turns",
    "file_affinity_summary",
    "verdicts",
    "recipe_applications",
] as const;

// 원장에 대응 이벤트가 없어 재생할 수 없는 소유 상태이며 리빌드가 절대 건드리지 않는다.
export const OWNED_TABLES = [
    "ai_jobs",
    "ai_job_steps",
    "rules",
    "recipes",
    "app_settings",
    "users",
    "task_user_state",
    "task_cleanup_suggestions",
    "search_outbox",
    "daemon_health",
] as const;

export type RebuildableTable = (typeof REBUILDABLE_TABLES)[number];
export type OwnedTable = (typeof OWNED_TABLES)[number];

const REBUILDABLE_SET = new Set<string>(REBUILDABLE_TABLES);
const OWNED_SET = new Set<string>(OWNED_TABLES);

export function isRebuildableTable(table: string): table is RebuildableTable {
    return REBUILDABLE_SET.has(table);
}

export function isOwnedTable(table: string): table is OwnedTable {
    return OWNED_SET.has(table);
}

// 리빌드가 지우려는 테이블이 정말 재생 가능한지 확인하며, 소유 테이블을 지우면 되돌릴 수 없다.
export function assertRebuildable(table: string): asserts table is RebuildableTable {
    if (!isRebuildableTable(table)) {
        throw new Error(`리빌드는 재생 가능한 테이블만 지운다. "${table}"은 대상이 아니다.`);
    }
}

// 부모를 먼저 지우면 외래키가 막으므로 자식부터 지우는 순서를 분류가 함께 소유한다.
export const REBUILD_TRUNCATE_ORDER: readonly RebuildableTable[] = [
    "verdicts",
    "recipe_applications",
    "file_affinity_summary",
    "turns",
    "events",
    "sessions",
    "tasks",
];
