import { useEffect, useState } from "react";

/** Returns the current time in milliseconds, refreshed every `intervalMs`. */
export function useNowMs(intervalMs = 10_000): number {
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return nowMs;
}
