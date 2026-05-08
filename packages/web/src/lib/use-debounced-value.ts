import { useEffect, useState } from "react";

/**
 * Returns `value` after `delayMs` of stability — i.e. it keeps the most
 * recently observed input but only re-publishes once the user stops
 * changing it.
 *
 * Used by the sidebar search to avoid firing a backend call on every
 * keystroke. 250ms is the default — fast enough that "what I just
 * typed" still feels live, slow enough to merge bursts of typing into
 * a single fetch.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
