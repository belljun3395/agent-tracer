/**
 * 검색 상태 훅.
 * debounce 180ms 적용, fetchSearchResults 호출.
 */

import { useEffect, useState } from "react";
import { fetchSearchResults } from "../api.js";
import type { SearchResponse } from "../types.js";

export interface UseSearchResult {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly results: SearchResponse | null;
  readonly isSearching: boolean;
  readonly errorMessage: string | null;
}

export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      void fetchSearchResults(normalizedQuery)
        .then((result) => {
          if (!cancelled) setResults(result);
        })
        .catch((err) => {
          if (!cancelled) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to search monitor data.");
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 180);

    return (): void => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { query, setQuery, results, isSearching, errorMessage };
}
