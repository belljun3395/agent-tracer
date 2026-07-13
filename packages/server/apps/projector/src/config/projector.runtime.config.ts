export interface ProjectorRuntimeConfig {
    readonly taskReaper: {
        readonly intervalMs: number;
        readonly idleMs: number;
    };
    readonly aiJobStepReaper: {
        readonly intervalMs: number;
        readonly retentionMs: number;
    };
    readonly searchEventsReaper: {
        readonly intervalMs: number;
        readonly retentionMs: number;
    };
    readonly searchOutboxDrainIntervalMs: number;
    readonly jobLeaseReapIntervalMs: number;
    readonly eventsOtlp: { readonly endpoint: string } | undefined;
}

type ProjectorRuntimeEnvironment = Readonly<Record<string, string | undefined>>;

const DEFAULTS = {
    taskReapIntervalMs: 60_000,
    taskReapIdleMs: 180_000,
    aiJobStepReapIntervalMs: 3_600_000,
    aiJobStepRetentionMs: 30 * 24 * 3_600_000,
    searchEventsReapIntervalMs: 6 * 3_600_000,
    searchEventsRetentionMs: 90 * 24 * 3_600_000,
    searchOutboxDrainIntervalMs: 5_000,
    jobLeaseReapIntervalMs: 30_000,
} as const;

/** Projector 프로세스의 외부 운영 설정을 부트스트랩 입력으로 변환한다. */
export function loadProjectorRuntimeConfig(
    environment: ProjectorRuntimeEnvironment = process.env,
): ProjectorRuntimeConfig {
    const otlpEndpoint = environment["EVENTS_OTLP_ENDPOINT"]?.trim();
    return {
        taskReaper: {
            intervalMs: positiveInt(environment, "PROJECTOR_REAP_INTERVAL_MS", DEFAULTS.taskReapIntervalMs),
            idleMs: positiveInt(environment, "PROJECTOR_REAP_IDLE_MS", DEFAULTS.taskReapIdleMs),
        },
        aiJobStepReaper: {
            intervalMs: positiveInt(
                environment,
                "PROJECTOR_AI_JOB_STEP_REAP_INTERVAL_MS",
                DEFAULTS.aiJobStepReapIntervalMs,
            ),
            retentionMs: positiveInt(
                environment,
                "PROJECTOR_AI_JOB_STEP_RETENTION_MS",
                DEFAULTS.aiJobStepRetentionMs,
            ),
        },
        searchEventsReaper: {
            intervalMs: positiveInt(
                environment,
                "PROJECTOR_SEARCH_EVENTS_REAP_INTERVAL_MS",
                DEFAULTS.searchEventsReapIntervalMs,
            ),
            retentionMs: positiveInt(
                environment,
                "PROJECTOR_SEARCH_EVENTS_RETENTION_MS",
                DEFAULTS.searchEventsRetentionMs,
            ),
        },
        searchOutboxDrainIntervalMs: positiveInt(
            environment,
            "PROJECTOR_SEARCH_OUTBOX_DRAIN_INTERVAL_MS",
            DEFAULTS.searchOutboxDrainIntervalMs,
        ),
        jobLeaseReapIntervalMs: positiveInt(
            environment,
            "PROJECTOR_JOB_LEASE_REAP_INTERVAL_MS",
            DEFAULTS.jobLeaseReapIntervalMs,
        ),
        eventsOtlp: otlpEndpoint ? { endpoint: otlpEndpoint.replace(/\/$/, "") } : undefined,
    };
}

function positiveInt(environment: ProjectorRuntimeEnvironment, name: string, fallback: number): number {
    const raw = Number.parseInt(environment[name] ?? "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
