import type {JsonObject} from "~shared/util/utils.type.js";
import type {HookLogger} from "./hook-log.js";
import {readStdinJson} from "./stdin.js";
import type {ReaderResult} from "./validator.js";

export interface RunHookOptions<T> {
    /**
     * Logger for hook-level telemetry. Typically produced by
     * `createHookRuntime({...}).logger`.
     */
    readonly logger: HookLogger;
    /**
     * Parses the raw stdin payload into the typed context the handler needs.
     * Return `{ ok: false, reason }` to skip the handler (handler body will
     * not run). `reason` is logged at info level.
     */
    readonly parse: (raw: JsonObject) => ReaderResult<T>;
    /**
     * The hook body. Only called when `parse` returns `{ ok: true }`.
     * Any thrown error is caught by `runHook` and logged; the hook still
     * exits 0 so Claude/Codex is never blocked on bugs in the hook itself.
     */
    readonly handler: (context: T) => Promise<void>;
    /**
     * If true, the parsed payload is also written to the payload log file
     * for local debugging. Default: true. Set to false for hooks that
     * process frequently-fired events where logging noise outweighs value.
     */
    readonly logPayload?: boolean;
}

/**
 * Standard entry point for every Agent Tracer hook script.
 *
 * Steps performed, in order:
 *   1. Read stdin as JSON (empty object on blank/invalid input).
 *   2. Optionally append the raw payload to the hook log file.
 *   3. Parse the payload into the typed context the handler expects.
 *      On parse failure, log the reason and return without calling the handler.
 *   4. Invoke the handler. Any error is caught and logged.
 *   5. Always returns 0 from the process (never blocks Claude / Codex),
 *      regardless of handler outcome.
 *
 * Usage:
 *   await runHook("SessionStart", { logger, parse, handler });
 *
 * This replaces the hand-rolled `main() + void main().catch(...)` pattern.
 */
export async function runHook<T>(
    name: string,
    options: RunHookOptions<T>,
): Promise<void> {
    const {logger, parse, handler} = options;
    const shouldLogPayload = options.logPayload ?? true;

    let raw: JsonObject;
    try {
        raw = await readStdinJson();
    } catch (err) {
        logger.log(name, "stdin_read_error", {error: errorMessage(err)});
        return;
    }

    if (shouldLogPayload) {
        logger.logPayload(name, raw);
    }

    const parsed = parse(raw);
    if (!parsed.ok) {
        logger.log(name, "skipped", {reason: parsed.reason});
        return;
    }

    try {
        await handler(parsed.value);
    } catch (err) {
        logger.log(name, "handler_error", {
            error: errorMessage(err),
            ...(err instanceof Error && err.stack ? {stack: err.stack} : {}),
        });
    }
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}
