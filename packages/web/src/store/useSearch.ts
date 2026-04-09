import { useEffect, useState } from "react";
import { fetchSearchResults } from "../api.js";
import type { SearchResponse } from "../types.js";
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
    const effectiveTaskId = taskScopeEnabled && scopedTaskId ? scopedTaskId : undefined;
    useEffect(() => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            setResults(null);
            setIsSearching(false);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            setIsSearching(true);
            void fetchSearchResults(normalizedQuery, effectiveTaskId)
                .then((result) => {
                if (!cancelled)
                    setResults(result);
            })
                .catch((err) => {
                if (!cancelled) {
                    setErrorMessage(err instanceof Error ? err.message : "Failed to search monitor data.");
                }
            })
                .finally(() => {
                if (!cancelled)
                    setIsSearching(false);
            });
        }, 180);
        return (): void => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, effectiveTaskId]);
    return { query, setQuery, results, isSearching, errorMessage, taskScopeEnabled, setTaskScopeEnabled };
}
