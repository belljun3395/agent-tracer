import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type DesktopPermission = "default" | "granted" | "denied" | "unsupported";

interface DesktopPrefState {
  /**
   * User intent: do they WANT desktop notifications? The actual ability
   * to fire one is gated by browser permission, but this flag separates
   * "permission denied" from "user disabled it themselves".
   */
  readonly enabled: boolean;
  readonly setEnabled: (value: boolean) => void;
}

const DESKTOP_PREF_KEY = "agent-tracer:notifications:desktop:v1";

export const useDesktopPref = create<DesktopPrefState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: DESKTOP_PREF_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function readBrowserPermission(): DesktopPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as DesktopPermission;
}

export interface DesktopNotifications {
  readonly enabled: boolean;
  readonly permission: DesktopPermission;
  readonly setEnabled: (next: boolean) => Promise<void>;
  readonly fire: (title: string, body?: string) => void;
}

/**
 * Glue between the persisted user preference and the browser permission API.
 *
 * The user toggle is sticky: once they say "yes" we keep firing as long as
 * the browser still permits it. If permission flips back to `default`
 * (Safari sometimes does this) we surface that via `permission` so the
 * Settings UI can re-prompt without surprising the user.
 *
 * `fire()` is a no-op when either side disagrees — never throws.
 */
export function useDesktopNotifications(): DesktopNotifications {
  const enabled = useDesktopPref((s) => s.enabled);
  const setEnabledPref = useDesktopPref((s) => s.setEnabled);
  const [permission, setPermission] = useState<DesktopPermission>(
    () => readBrowserPermission(),
  );

  useEffect(() => {
    // Re-read on focus — covers the case where the user toggles the OS
    // permission in browser settings while the tab is open.
    const onFocus = () => setPermission(readBrowserPermission());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (!next) {
        setEnabledPref(false);
        return;
      }
      if (permission === "unsupported" || permission === "denied") {
        // Honor browser-level deny; user has to fix it themselves.
        setEnabledPref(false);
        return;
      }
      if (permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result as DesktopPermission);
        setEnabledPref(result === "granted");
        return;
      }
      setEnabledPref(true);
    },
    [permission, setEnabledPref],
  );

  const fire = useCallback(
    (title: string, body?: string) => {
      if (!enabled) return;
      if (permission !== "granted") return;
      try {
        new Notification(title, body ? { body } : undefined);
      } catch {
        // Some browsers throw if the document isn't visible; we don't
        // care — the in-app toast already covers the case.
      }
    },
    [enabled, permission],
  );

  return { enabled, permission, setEnabled, fire };
}
