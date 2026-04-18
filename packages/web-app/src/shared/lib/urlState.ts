// Typed URL search-parameter helpers.
//
// Treats the URL as the single source of truth for shareable selection state
// (current task, active tab, etc.). Callers never mutate a captured
// URLSearchParams snapshot — they call the returned setter, which uses
// React Router's functional updater form so writes always compose against
// the *latest* search params. That is what prevents the class of bugs fixed
// by commits 3ee36f4 and b47d206, where a stale Suspense fiber or a delayed
// effect wrote back an outdated URL.

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function writeSearchParam(
    current: URLSearchParams,
    key: string,
    next: string | null
): URLSearchParams {
    const copy = new URLSearchParams(current);
    if (next === null || next === "") {
        copy.delete(key);
    } else {
        copy.set(key, next);
    }
    return copy;
}

export type UrlSearchParamSetter = (next: string | null) => void;

export interface UseUrlSearchParamOptions {
    /** When true (default), updates use history.replace instead of push. */
    readonly replace?: boolean;
}

export function useUrlSearchParam(
    key: string,
    options: UseUrlSearchParamOptions = {}
): readonly [string | null, UrlSearchParamSetter] {
    const [searchParams, setSearchParams] = useSearchParams();
    const value = useMemo(() => searchParams.get(key), [searchParams, key]);
    const replace = options.replace ?? true;
    const setValue = useCallback<UrlSearchParamSetter>(
        (next) => {
            setSearchParams((prev) => writeSearchParam(prev, key, next), { replace });
        },
        [key, replace, setSearchParams]
    );
    return [value, setValue];
}
