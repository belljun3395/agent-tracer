export async function refreshRealtimeMonitorData(input: {
  selectedTaskId: string | null;
  refreshOverview: () => Promise<void>;
  refreshTaskDetail: (taskId: string) => Promise<void>;
}): Promise<void> {
  await Promise.all([
    input.refreshOverview(),
    ...(input.selectedTaskId ? [input.refreshTaskDetail(input.selectedTaskId)] : [])
  ]);
}
