import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/ui/cn.js";
import { getConfig, updateConfig, type AgentTracerConfig } from "../../../io/api.js";

const CONFIG_QUERY_KEY = ["config"] as const;

export function NotificationsToggle(): React.JSX.Element {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: CONFIG_QUERY_KEY,
        queryFn: getConfig,
    });
    const mutation = useMutation({
        mutationFn: (next: AgentTracerConfig) => updateConfig(next),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
        },
    });

    const config = query.data ?? {};
    const enabled = config["notifications.os"] !== false;
    const disabled = query.isLoading || mutation.isPending;

    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Disable desktop notifications" : "Enable desktop notifications"}
            disabled={disabled}
            title={enabled
                ? "Notifications on — click to mute new contradictions"
                : "Notifications off — click to alert on new contradictions"}
            onClick={() => {
                mutation.mutate({
                    ...config,
                    "notifications.os": !enabled,
                });
            }}
            className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-[0.72rem] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
                enabled
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)]",
                disabled && "cursor-wait opacity-60",
            )}
        >
            <svg
                aria-hidden="true"
                fill={enabled ? "currentColor" : "none"}
                height="13"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="13"
            >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                {!enabled && <path d="M3 3l18 18" />}
            </svg>
            <span className="hidden xl:inline">Notify</span>
        </button>
    );
}
