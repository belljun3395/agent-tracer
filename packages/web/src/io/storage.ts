// Safe wrapper around the Web Storage API.
//
// Storage access can throw in several environments that the app must still
// tolerate: Safari private mode (SecurityError on read), quota exhaustion on
// write, cross-origin iframe restrictions, and completely missing Storage
// (non-browser runtimes). Rather than spreading try/catch blocks across
// components, callers obtain a `SafeStorage` via `createSafeStorage` and get
// back typed results that never throw.

export type StorageParser<T> = (raw: string) => T | undefined;

export type StorageWriteFailureReason =
    | "unavailable"
    | "quota"
    | "unknown";

export interface StorageWriteResult {
    readonly ok: boolean;
    readonly reason?: StorageWriteFailureReason;
}

export interface SafeStorage {
    /**
     * Read a value. Returns `fallback` when the key is missing, storage is
     * unavailable, the underlying Storage throws, or `parse` rejects the
     * stored string.
     */
    readonly get: <T>(
        key: string,
        parse: StorageParser<T>,
        fallback: T
    ) => T;

    /**
     * Persist a string value. Never throws; returns an ok/reason result so
     * callers can choose whether to surface write failures.
     */
    readonly set: (key: string, value: string) => StorageWriteResult;

    /**
     * Best-effort delete. Errors are swallowed.
     */
    readonly remove: (key: string) => void;

    /** Whether the underlying Storage is accessible at all. */
    readonly isAvailable: boolean;
}

// Intentional re-export name used by the validator variant below.
export type StorageValidator<T> = StorageParser<T>;

export function createSafeStorage(
    storage: Storage | null | undefined
): SafeStorage {
    const available = storage !== null && storage !== undefined;

    return {
        isAvailable: available,

        get<T>(key: string, parse: StorageParser<T>, fallback: T): T {
            if (!available) {
                return fallback;
            }
            let raw: string | null;
            try {
                raw = storage.getItem(key);
            } catch {
                return fallback;
            }
            if (raw === null) {
                return fallback;
            }
            try {
                const parsed = parse(raw);
                return parsed === undefined ? fallback : parsed;
            } catch {
                return fallback;
            }
        },

        set(key: string, value: string): StorageWriteResult {
            if (!available) {
                return { ok: false, reason: "unavailable" };
            }
            try {
                storage.setItem(key, value);
                return { ok: true };
            } catch (error: unknown) {
                return { ok: false, reason: classifyWriteError(error) };
            }
        },

        remove(key: string): void {
            if (!available) {
                return;
            }
            try {
                storage.removeItem(key);
            } catch {
                // Intentionally swallowed — removal is best-effort.
            }
        }
    };
}

function classifyWriteError(error: unknown): StorageWriteFailureReason {
    if (error instanceof Error) {
        const name = error.name.toLowerCase();
        if (name.includes("quota")) {
            return "quota";
        }
        if (name === "securityerror") {
            return "unavailable";
        }
    }
    return "unknown";
}
