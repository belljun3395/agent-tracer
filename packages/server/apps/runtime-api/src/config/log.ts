import { SystemClock } from "@monitor/platform";

const clock = new SystemClock();

function write(stream: NodeJS.WriteStream, level: string, fields: Record<string, unknown>): void {
    stream.write(`${JSON.stringify({ level, ts: clock.nowIso(), ...fields })}\n`);
}

export function logInfo(fields: Record<string, unknown>): void {
    write(process.stdout, "info", fields);
}

export function logError(fields: Record<string, unknown>): void {
    write(process.stderr, "error", fields);
}

export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "unknown error";
}
