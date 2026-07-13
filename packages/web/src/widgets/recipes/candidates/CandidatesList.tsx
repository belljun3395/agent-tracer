import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import type { Recipe } from "~web/entities/recipe/model/recipe.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, EmptyHint, GuidanceText } from "~web/shared/ui/index.js";
import {
  useAcceptRecipeMutation,
  useDismissRecipeMutation,
} from "~web/entities/recipe/api/mutations.js";
import { useSubmitJobFeedbackMutation } from "~web/entities/job/api/mutations.js";
import { JobFeedbackBar } from "~web/features/job-feedback/JobFeedbackBar.js";
import { RecipeCard } from "~web/widgets/recipes/presentation/RecipeCard.js";

interface CandidatesListProps {
  readonly rows: readonly Recipe[];
  readonly loading: boolean;
  readonly taskTitleById: ReadonlyMap<string, string>;
}

/** 스캔이 제안한 레시피 후보의 검토 결정을 제공한다. */
export function CandidatesList({ rows, loading, taskTitleById }: CandidatesListProps) {
  const guidance = useGuidance();
  if (loading) return <EmptyHint>Loading candidates…</EmptyHint>;
  if (rows.length === 0) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.recipes.candidatesEmpty}
        />
      </EmptyHint>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((c) => (
        <CandidateCard key={c.id} candidate={c} taskTitleById={taskTitleById} />
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  taskTitleById,
}: {
  readonly candidate: Recipe;
  readonly taskTitleById: ReadonlyMap<string, string>;
}) {
  const accept = useAcceptRecipeMutation();
  const dismiss = useDismissRecipeMutation();
  const feedback = useSubmitJobFeedbackMutation();
  const pending = accept.isPending || dismiss.isPending;
  const sourceJobId = candidate.sourceJobId;

  return (
    <RecipeCard
      recipe={candidate}
      taskTitleById={taskTitleById}
      footMetaAt={candidate.createdAt}
      {...(sourceJobId ? { feedback: <JobFeedbackBar jobId={sourceJobId} subject="recipe" /> } : {})}
      showParentBadge
      showRationale
      actions={
        <>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => {
              if (sourceJobId) feedback.mutate({ jobId: sourceJobId, kind: JOB_FEEDBACK_KIND.accept });
              accept.mutate(candidate.id);
            }}
          >
            Accept
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (sourceJobId) feedback.mutate({ jobId: sourceJobId, kind: JOB_FEEDBACK_KIND.reject });
              dismiss.mutate(candidate.id);
            }}
          >
            Dismiss
          </Button>
        </>
      }
    />
  );
}
