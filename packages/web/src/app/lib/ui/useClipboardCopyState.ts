import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "./clipboard.js";

export type ClipboardCopyState = "idle" | "working" | "copied" | "error";

export interface UseClipboardCopyStateOptions {
    /** ms to keep "copied" before auto-resetting to "idle" (default 2000). */
    readonly copiedResetMs?: number;
    /** ms to keep "error" before auto-resetting (default 3000). */
    readonly errorResetMs?: number;
    /** Optional async work that produces the text to copy (e.g. fetch summary). */
    readonly working?: boolean;
}

const DEFAULT_COPIED_RESET = 2_000;
const DEFAULT_ERROR_RESET = 3_000;

/**
 * Encapsulates the "copy to clipboard with status" pattern: idle → working
 * → copied | error → idle. Caller passes a `produce` thunk that returns the
 * text to copy (it can `await` for async preparation like generating a
 * summary). The hook manages the auto-reset timer + cleanup.
 */
export function useClipboardCopyState(opts: UseClipboardCopyStateOptions = {}): {
    readonly state: ClipboardCopyState;
    readonly run: (produce: () => string | Promise<string>) => Promise<void>;
} {
    const [state, setState] = useState<ClipboardCopyState>("idle");
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
    }, []);

    function scheduleReset(delayMs: number): void {
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setState("idle"), delayMs);
    }

    async function run(produce: () => string | Promise<string>): Promise<void> {
        if (state === "working") return;
        try {
            const maybeAsync = produce();
            const text = typeof maybeAsync === "string"
                ? maybeAsync
                : (setState("working"), await maybeAsync);
            const ok = await copyToClipboard(text);
            setState(ok ? "copied" : "error");
            scheduleReset(ok ? (opts.copiedResetMs ?? DEFAULT_COPIED_RESET) : (opts.errorResetMs ?? DEFAULT_ERROR_RESET));
        } catch {
            setState("error");
            scheduleReset(opts.errorResetMs ?? DEFAULT_ERROR_RESET);
        }
    }

    return { state, run };
}
