import { useEffect, useState } from "react";

/** 현재 시각을 반환하고 지정한 주기로 갱신한다. */
export function useNowMs(intervalMs = 10_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return nowMs;
}
