/**
 * Error thrown by the transport layer when the monitor returns a non-2xx
 * response or the request fails. Preserves the envelope so hook handlers
 * can branch on `code` instead of parsing `message` strings.
 */
export class MonitorRequestError extends Error {
    readonly status: number;
    readonly pathname: string;
    readonly code: string | undefined;
    readonly details: unknown;

    constructor(init: {
        status: number;
        pathname: string;
        message: string;
        code?: string | undefined;
        details?: unknown;
    }) {
        super(init.message);
        this.name = "MonitorRequestError";
        this.status = init.status;
        this.pathname = init.pathname;
        this.code = init.code;
        this.details = init.details;
    }
}
