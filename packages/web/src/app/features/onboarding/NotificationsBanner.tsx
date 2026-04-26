import type React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConfig } from "../../../io/api.js";

const KEY = "agent-tracer.notifications.banner.dismissed";

export function NotificationsBanner(): React.JSX.Element | null {
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === "1");
    const configQuery = useQuery({ queryKey: ["config"], queryFn: getConfig });

    if (dismissed) return null;
    // Don't claim "notifications are ON" if the user has already turned them
    // off — banner only narrates the default-enabled state to first-run users.
    if (configQuery.data?.["notifications.os"] === false) return null;

    return (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] px-3 py-2 text-[0.74rem] text-[var(--text-2)]">
            <span>
                Desktop notifications are ON for new contradicted turns. You can disable them anytime in Settings.
            </span>
            <button
                type="button"
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.7rem] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                onClick={() => {
                    localStorage.setItem(KEY, "1");
                    setDismissed(true);
                }}
            >
                Got it
            </button>
        </div>
    );
}
