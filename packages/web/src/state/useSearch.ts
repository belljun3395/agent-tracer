import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { TaskId } from "~domain/monitoring.js";
import { fetchSearchResults } from "~io/api.js";
import type { SearchResponse } from "~domain/search-contracts.js";
import { monitorQueryKeys } from "./server/queryKeys.js";

export interface UseSearchResult {
    readonly query: string;
    readonly setQuery: (query: string) => void;
    readonly results: SearchResponse | null;
    readonly isSearching: boolean;
    readonly errorMessage: string | null;
    readonly taskScopeEnabled: boolean;
    readonly setTaskScopeEnabled: (enabled: boolean) => void;
}

const DEBOUNCE_MS = 180;

export function useSearch(scopedTaskId?: string): UseSearchResult {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [taskScopeEnabled, setTaskScopeEnabled] = useState(false);

    const effectiveTaskId = taskScopeEnabled && scopedTaskId ? TaskId(scopedTaskId) : undefined;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    const { data, isFetching, error } = useQuery({
        queryKey: monitorQueryKeys.search(debouncedQuery, effectiveTaskId),
        queryFn: () => fetchSearchResults(debouncedQuery, effectiveTaskId),
        enabled: debouncedQuery.length > 0,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });

    return {
        query,
        setQuery,
        results: debouncedQuery.length > 0 ? (data ?? null) : null,
        isSearching: isFetching,
        errorMessage: error == null ? null : error.message,
        taskScopeEnabled,
        setTaskScopeEnabled,
    };
}
