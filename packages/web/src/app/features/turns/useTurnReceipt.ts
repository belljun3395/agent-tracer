import { useQuery } from "@tanstack/react-query";
import { getTurnReceipt } from "../../../io/api.js";

export function useTurnReceipt(turnId: string | null) {
    return useQuery({
        queryKey: ["turn-receipt", turnId] as const,
        queryFn: () => {
            if (turnId === null) {
                throw new Error("useTurnReceipt called without a turnId");
            }
            return getTurnReceipt(turnId);
        },
        enabled: turnId !== null,
        staleTime: 30_000,
    });
}
