import { useCallback } from "react";
import type {
  MonitorRealtimeMessage,
  SdkJobKind,
  SdkJobUpdatedPayload,
} from "~io/realtime.js";
import { useDesktopNotifications } from "./useDesktopNotifications.js";
import { useToastStore } from "./toastStore.js";

const KIND_LABEL: Readonly<Record<SdkJobKind, string>> = {
  "title-suggestion": "Title suggestion",
  "task-cleanup": "Task cleanup",
  "recipe-scan": "Recipe scan",
  "rule-generation": "Rule generation",
};

/**
 * Subscribe to `sdk_job.updated` WS messages and surface them as toasts.
 * Only terminal states (succeeded/failed) raise a notification — the
 * `running` ping is reserved for future progress UI.
 *
 * Returns an `onMessage` callback meant to be passed to `useMonitorSocket`.
 */
export function useSdkJobToasts(): (msg: MonitorRealtimeMessage) => void {
  const push = useToastStore((s) => s.push);
  const desktop = useDesktopNotifications();

  return useCallback(
    (msg) => {
      if (msg.type !== "sdk_job.updated") return;
      const payload = msg.payload;
      if (payload.status === "running") return;
      const title = formatTitle(payload);
      const body = formatBody(payload);
      push({
        tone: payload.status === "failed" ? "error" : "success",
        title,
        ...(body ? { body } : {}),
      });
      desktop.fire(title, body);
    },
    [push, desktop],
  );
}

function formatTitle(payload: SdkJobUpdatedPayload): string {
  const label = KIND_LABEL[payload.kind];
  return payload.status === "failed"
    ? `${label} failed`
    : `${label} complete`;
}

function formatBody(payload: SdkJobUpdatedPayload): string | undefined {
  if (payload.status === "failed") return payload.error;
  return payload.summary;
}
