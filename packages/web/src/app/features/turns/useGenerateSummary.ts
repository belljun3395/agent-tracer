import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateTurnSummary } from "../../../io/api.js";

export function useGenerateSummary(turnId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (args: { readonly force?: boolean } = {}) =>
            generateTurnSummary(turnId, args),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["turn-receipt", turnId] });
        },
    });
}
