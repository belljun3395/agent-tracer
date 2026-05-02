export interface ContextWarningPrefs {
    readonly enabled: boolean;
    readonly thresholdPct: number;
}

const CONTEXT_WARNING_STORAGE_KEY = "agent-tracer.context-warning";
export const DEFAULT_CONTEXT_WARNING_PREFS: ContextWarningPrefs = {
    enabled: true,
    thresholdPct: 80,
};

const subscribers = new Set<() => void>();
let cachedRawPrefs: string | null = null;
let cachedPrefs: ContextWarningPrefs = DEFAULT_CONTEXT_WARNING_PREFS;

export function normalizeContextWarningThreshold(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_CONTEXT_WARNING_PREFS.thresholdPct;
    return Math.min(100, Math.max(1, Math.round(value)));
}

function normalizeContextWarningPrefs(
    input?: Partial<ContextWarningPrefs> | null,
): ContextWarningPrefs {
    return {
        enabled: input?.enabled ?? DEFAULT_CONTEXT_WARNING_PREFS.enabled,
        thresholdPct: normalizeContextWarningThreshold(
            input?.thresholdPct ?? DEFAULT_CONTEXT_WARNING_PREFS.thresholdPct,
        ),
    };
}

function parseContextWarningPrefs(raw: string | null | undefined): ContextWarningPrefs {
    if (!raw) return DEFAULT_CONTEXT_WARNING_PREFS;
    try {
        const parsed = JSON.parse(raw) as Partial<ContextWarningPrefs>;
        return normalizeContextWarningPrefs(parsed);
    } catch {
        return DEFAULT_CONTEXT_WARNING_PREFS;
    }
}

export function readContextWarningPrefs(storage?: Storage): ContextWarningPrefs {
    if (storage == null && typeof window === "undefined") {
        return DEFAULT_CONTEXT_WARNING_PREFS;
    }
    try {
        const raw = (storage ?? window.localStorage).getItem(CONTEXT_WARNING_STORAGE_KEY);
        if (raw === cachedRawPrefs) return cachedPrefs;
        cachedRawPrefs = raw;
        cachedPrefs = parseContextWarningPrefs(raw);
        return cachedPrefs;
    } catch {
        return DEFAULT_CONTEXT_WARNING_PREFS;
    }
}

export function writeContextWarningPrefs(next: ContextWarningPrefs, storage?: Storage): void {
    if (storage == null && typeof window === "undefined") {
        return;
    }
    const normalized = normalizeContextWarningPrefs(next);
    const serialized = JSON.stringify(normalized);
    cachedRawPrefs = serialized;
    cachedPrefs = normalized;
    try {
        (storage ?? window.localStorage).setItem(CONTEXT_WARNING_STORAGE_KEY, serialized);
    } catch {
        void 0;
    }
    for (const subscriber of subscribers) subscriber();
}

export function subscribeContextWarningPrefs(listener: () => void): () => void {
    subscribers.add(listener);
    return () => {
        subscribers.delete(listener);
    };
}

function shouldShowContextWarning(
    currentPct: number | null | undefined,
    prefs: ContextWarningPrefs,
): boolean {
    return prefs.enabled && typeof currentPct === "number" && currentPct >= prefs.thresholdPct;
}
