import { useEffect, useState } from "react";
import { TaskId } from "@monitor/core";
import { fetchSearchResults } from "@monitor/web-core";
import type { SearchResponse } from "@monitor/web-core";
export interface UseSearchResult {
    readonly query: string;
    readonly setQuery: (query: string) => void;
    readonly results: SearchResponse | null;
    readonly isSearching: boolean;
    readonly errorMessage: string | null;
    readonly taskScopeEnabled: boolean;
    readonly setTaskScopeEnabled: (enabled: boolean) => void;
}
export function useSearch(scopedTaskId?: string): UseSearchResult {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResponse | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [taskScopeEnabled, setTaskScopeEnabled] = useState(false);
    const effectiveTaskId = taskScopeEnabled && scopedTaskId ? TaskId(scopedTaskId) : undefined;
    useEffect(() => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            setResults(null);
            setIsSearching(false);
            setErrorMessage(null);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setIsSearching(true);
            setErrorMessage(null);
            void fetchSearchResults(normalizedQuery, effectiveTaskId, { signal: controller.signal })
                .then((result) => {
                if (!controller.signal.aborted) {
                    setResults(result);
                }
            })
                .catch((err) => {
                if (!controller.signal.aborted) {
                    setErrorMessage(err instanceof Error ? err.message : "Failed to search monitor data.");
                }
            })
                .finally(() => {
                setIsSearching(false);
            });
        }, 180);
        return (): void => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, effectiveTaskId]);
    return { query, setQuery, results, isSearching, errorMessage, taskScopeEnabled, setTaskScopeEnabled };
}
