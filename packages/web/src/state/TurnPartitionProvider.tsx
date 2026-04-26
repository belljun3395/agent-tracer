import type React from "react";
import { createContext, useContext } from "react";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import { useTurnPartition, type UseTurnPartitionResult } from "./useTurnPartition.js";

const TurnPartitionContext = createContext<UseTurnPartitionResult | null>(null);

export function TurnPartitionProvider({
    taskId,
    timeline,
    children,
}: {
    readonly taskId: string | null;
    readonly timeline: readonly TimelineEventRecord[];
    readonly children: React.ReactNode;
}): React.JSX.Element {
    const value = useTurnPartition(taskId ?? "", timeline);
    return <TurnPartitionContext.Provider value={value}>{children}</TurnPartitionContext.Provider>;
}

export function useTurnPartitionContext(): UseTurnPartitionResult | null {
    return useContext(TurnPartitionContext);
}
