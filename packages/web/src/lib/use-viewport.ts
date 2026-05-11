import { useEffect, useState } from "react";

/**
 * Responsive viewport buckets used by `AppShell`. Thresholds picked
 * from observed audit screenshots:
 *
 *   • ≥1024 px (`wide`)   — full three-column grid (sidebar + main + inspector)
 *   • 720–1023 (`narrow`) — sidebar + main; inspector slides over as a drawer
 *   • <720    (`mobile`)  — single column; sidebar and inspector are drawers
 */
export type ViewportTier = "wide" | "narrow" | "mobile";

const WIDE_MIN = 1024;
const NARROW_MIN = 720;

function tierFor(width: number): ViewportTier {
  if (width >= WIDE_MIN) return "wide";
  if (width >= NARROW_MIN) return "narrow";
  return "mobile";
}

export function useViewport(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() => {
    if (typeof window === "undefined") return "wide";
    return tierFor(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const onResize = () => {
      // Coalesce rapid resize events into a single rAF so we don't
      // re-render the whole shell mid-drag.
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setTier(tierFor(window.innerWidth));
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return tier;
}
