import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { TaskDetailResponse } from "~web/entities/task/model/task-query.js";
import { prependPageToTimelineWindow } from "~web/entities/task/model/timeline/timeline-window.js";
import { fetchOlderTaskTimeline } from "~web/entities/task/api/timeline.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useLoadOlderTimelineMutation(taskId: TaskId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cursor: string) => fetchOlderTaskTimeline(taskId, cursor),
    onSuccess: (page) => {
      queryClient.setQueryData<TaskDetailResponse | undefined>(
        monitorQueryKeys.taskDetail(taskId),
        (previous) =>
          previous
            ? {
                ...previous,
                timeline: prependPageToTimelineWindow(previous.timeline, page.timeline),
                olderCursor: page.olderCursor,
              }
            : previous,
      );
    },
  });
}
