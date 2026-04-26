interface ContextWindow {
    readonly used_percentage?: number | null;
    readonly remaining_percentage?: number | null;
    readonly total_input_tokens?: number;
    readonly total_output_tokens?: number;
    readonly context_window_size?: number;
    readonly current_usage?: {
        readonly input_tokens?: number;
        readonly output_tokens?: number;
        readonly cache_creation_input_tokens?: number;
        readonly cache_read_input_tokens?: number;
    } | null;
}

interface RateLimitWindow {
    readonly used_percentage?: number;
    readonly resets_at?: number;
}

interface RateLimits {
    readonly five_hour?: RateLimitWindow;
    readonly seven_day?: RateLimitWindow;
}

export interface StatusLinePayload {
    readonly session_id?: string;
    readonly version?: string;
    readonly model?: { readonly id?: string; readonly display_name?: string };
    readonly context_window?: ContextWindow;
    readonly cost?: { readonly total_cost_usd?: number };
    readonly rate_limits?: RateLimits;
}

export function formatStatusText(
    payload: StatusLinePayload,
): string {
    const parts: string[] = [];

    const ctx = payload.context_window;
    if (ctx?.used_percentage != null) {
        parts.push(`ctx ${Math.round(ctx.used_percentage)}%`);
    }

    const rl = payload.rate_limits;
    if (rl?.five_hour?.used_percentage != null) {
        parts.push(`5h ${Math.round(rl.five_hour.used_percentage)}%`);
    }

    const cost = payload.cost?.total_cost_usd;
    if (cost != null && cost > 0) {
        parts.push(`$${cost.toFixed(3)}`);
    }

    return parts.length > 0 ? `[monitor] ${parts.join(" · ")}` : "";
}
