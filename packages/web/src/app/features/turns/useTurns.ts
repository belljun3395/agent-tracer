import { useQuery } from "@tanstack/react-query";
import { listTurns, type ListTurnsArgs } from "../../../io/api.js";

export function useTurns(args: ListTurnsArgs = {}) {
    return useQuery({
        queryKey: ["turns", args] as const,
        queryFn: () => listTurns(args),
        staleTime: 5_000,
    });
}
