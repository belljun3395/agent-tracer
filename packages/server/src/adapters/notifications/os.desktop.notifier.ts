import notifier from "node-notifier";
import type {
    MonitorNotification,
    SdkJobKind,
    SdkJobUpdatedNotificationPayload,
} from "./notification.publisher.port.js";

const SDK_JOB_LABEL: Readonly<Record<SdkJobKind, string>> = {
    "title-suggestion": "Title suggestion",
    "task-cleanup": "Task cleanup",
    "recipe-scan": "Recipe scan",
    "rule-generation": "Rule generation",
};

export interface IOsDesktopNotifier {
    /**
     * Best-effort OS desktop notification. Swallows errors — failure to
     * surface a banner must never break the publish pipeline.
     */
    notify(notification: MonitorNotification): void;
}

/**
 * Server-side OS desktop notifier (macOS / Linux / Windows via node-notifier).
 *
 * The web `Notification` API path was unreliable on macOS — Chrome's
 * `permission==='granted'` is sufficient to fire `onshow`, but macOS can
 * silently drop the banner if the per-app system setting is off, leaving
 * the UI claiming success while nothing actually surfaces. Driving the
 * banner from the server makes the monitor process (a thing the user
 * already grants OS notification permission to, once) the single authority.
 *
 * Only fires for terminal `sdk_job.updated` states — running pings stay
 * in-app via the WS toast.
 */
export class OsDesktopNotifier implements IOsDesktopNotifier {
    notify(notification: MonitorNotification): void {
        if (notification.type !== "sdk_job.updated") return;
        const payload = notification.payload;
        if (payload.status !== "succeeded" && payload.status !== "failed") return;
        const { title, message } = formatBanner(payload);
        try {
            notifier.notify({ title, message, sound: false, wait: false });
            process.stdout.write(`[os-notifier] fired ${payload.kind}/${payload.status}\n`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[os-notifier] failed: ${msg}\n`);
        }
    }
}

function formatBanner(payload: SdkJobUpdatedNotificationPayload): {
    readonly title: string;
    readonly message: string;
} {
    const label = SDK_JOB_LABEL[payload.kind];
    if (payload.status === "failed") {
        return {
            title: `${label} failed`,
            message: payload.error ?? "Job ended with an error.",
        };
    }
    return {
        title: `${label} complete`,
        message: payload.summary ?? "Done.",
    };
}
