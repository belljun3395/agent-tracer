import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RecipeScanJobInput, RecipeScanJobStatus } from "~web/entities/job/model/recipe-scan.js";
import { JOB_KIND, isActiveJobStatus } from "~web/entities/job/model/job.js";
import { useEnqueueJob } from "~web/entities/job/api/mutations.js";
import { useJobStatus } from "~web/entities/job/api/queries.js";
import { useRecipesQuery } from "~web/entities/recipe/api/queries.js";
import { useScanAnchorTasksQuery } from "~web/entities/task/api/list-queries.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";
import { ScanPanel } from "~web/widgets/recipes/scan/ScanPanel.js";
import { RecipeSectionTabs, type RecipeSectionTab } from "~web/widgets/recipes/RecipeSectionTabs.js";
import { CandidatesList } from "~web/widgets/recipes/candidates/CandidatesList.js";
import { ActiveRecipesList, ArchivedRecipesList } from "~web/widgets/recipes/library/RecipeLibraryLists.js";
import { isArchivedRecipe } from "~web/widgets/recipes/library/recipe-status.js";
import { collectScannedTaskIds } from "~web/widgets/recipes/scan/scan-anchor.js";

/**
 * `/recipes`. 완료된 태스크에서 추출한 정제 패턴을 후보·활성·보관 탭으로 보여준다.
 */
export function RecipesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<RecipeSectionTab>("candidates");
  const job = useJobStatus<RecipeScanJobStatus>(JOB_KIND.recipeScan);
  const candidates = useRecipesQuery("candidate");
  const active = useRecipesQuery("active");
  const archive = useRecipesQuery("all");
  const [includeArchivedTasks, setIncludeArchivedTasks] = useState(false);
  const anchorTasks = useScanAnchorTasksQuery(includeArchivedTasks);
  const enqueue = useEnqueueJob<RecipeScanJobInput>(JOB_KIND.recipeScan);

  const taskTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const q of [candidates.data, active.data, archive.data]) {
      for (const [id, title] of q?.taskTitleById ?? []) m.set(id, title);
    }
    return m;
  }, [candidates.data, active.data, archive.data]);

  const scannedTaskIds = useMemo(
    () => collectScannedTaskIds([candidates.data, active.data, archive.data]),
    [candidates.data, active.data, archive.data],
  );

  const scanStatus = job.data?.job?.status;
  const isScanning = isActiveJobStatus(scanStatus);

  useEffect(() => {
    if (scanStatus === "completed") {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.recipesPrefix() });
    }
  }, [scanStatus, queryClient]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-canvas">
      <ScanPanel
        isScanning={isScanning || enqueue.isPending}
        latestJob={job.data?.job ?? null}
        tasks={anchorTasks.data?.tasks ?? []}
        tasksLoading={anchorTasks.isLoading}
        scannedTaskIds={scannedTaskIds}
        includeArchivedTasks={includeArchivedTasks}
        onIncludeArchivedTasksChange={setIncludeArchivedTasks}
        onScan={(input) => enqueue.mutate(input)}
        scanError={enqueue.isError ? readErrorMessage(enqueue.error) : null}
      />
      <RecipeSectionTabs
        active={tab}
        onSelect={setTab}
        counts={{
          candidates: candidates.data?.recipes.length ?? 0,
          active: active.data?.recipes.length ?? 0,
          archive: archive.data?.recipes.filter(isArchivedRecipe).length ?? 0,
        }}
      />
      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-6 pb-6">
        {tab === "candidates" && (
          <CandidatesList
            rows={candidates.data?.recipes ?? []}
            loading={candidates.isLoading}
            taskTitleById={taskTitleById}
          />
        )}
        {tab === "active" && (
          <ActiveRecipesList
            rows={active.data?.recipes ?? []}
            loading={active.isLoading}
            taskTitleById={taskTitleById}
          />
        )}
        {tab === "archive" && (
          <ArchivedRecipesList
            rows={(archive.data?.recipes ?? []).filter(isArchivedRecipe)}
            loading={archive.isLoading}
            taskTitleById={taskTitleById}
          />
        )}
      </div>
    </div>
  );
}

function readErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Scan failed";
}
