import { useEffect, useState } from "react";

/** `AppShell`이 쓰는 반응형 뷰포트 구간. */
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
      // 빠르게 연속되는 resize 이벤트를 rAF 하나로 합쳐, 드래그 도중
      // 셸 전체가 재렌더링되지 않게 한다.
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
