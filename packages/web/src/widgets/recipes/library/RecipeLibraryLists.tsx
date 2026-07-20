import { useState } from "react";
import type { Recipe, RecipeVerdictBreakdown } from "~web/entities/recipe/model/recipe.js";
import { Button, EmptyHint, GuidanceText, Modal } from "~web/shared/ui/index.js";
import {
  useDeleteRecipeMutation,
  useEditRecipeMutation,
  useRetireRecipeMutation,
} from "~web/entities/recipe/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { RecipeCard } from "~web/widgets/recipes/presentation/RecipeCard.js";
import { canDeleteRecipe } from "~web/widgets/recipes/library/recipe-status.js";

interface ListProps {
  readonly rows: readonly Recipe[];
  readonly loading: boolean;
  readonly taskTitleById: ReadonlyMap<string, string>;
}

/** 승인된 레시피를 수정·보관하는 라이브러리를 표시한다. */
export function ActiveRecipesList({ rows, loading, taskTitleById }: ListProps) {
  const guidance = useGuidance();
  if (loading) return <EmptyHint>Loading recipes…</EmptyHint>;
  if (rows.length === 0) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.recipes.activeEmpty}
        />
      </EmptyHint>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <ActiveRecipeCard key={r.id} recipe={r} taskTitleById={taskTitleById} />
      ))}
    </div>
  );
}

export function ArchivedRecipesList({ rows, loading, taskTitleById }: ListProps) {
  const guidance = useGuidance();
  if (loading) return <EmptyHint>Loading archive…</EmptyHint>;
  if (rows.length === 0) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.recipes.archiveEmpty}
        />
      </EmptyHint>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <ActiveRecipeCard key={r.id} recipe={r} taskTitleById={taskTitleById} muted />
      ))}
    </div>
  );
}

function ActiveRecipeCard({
  recipe,
  taskTitleById,
  muted = false,
}: {
  readonly recipe: Recipe;
  readonly taskTitleById: ReadonlyMap<string, string>;
  readonly muted?: boolean;
}) {
  const guidance = useGuidance();
  const retire = useRetireRecipeMutation();
  const edit = useEditRecipeMutation();
  const remove = useDeleteRecipeMutation();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState(() => ({
    title: recipe.title,
    intent: recipe.intent,
    description: recipe.description,
    summaryMd: recipe.summaryMd,
  }));
  const [error, setError] = useState<string | null>(null);

  function closeEditor() {
    setEditing(false);
    setError(null);
    setForm({
      title: recipe.title,
      intent: recipe.intent,
      description: recipe.description,
      summaryMd: recipe.summaryMd,
    });
  }

  function saveEdit() {
    setError(null);
    edit.mutate(
      {
        recipeId: recipe.id,
        body: {
          title: form.title.trim(),
          intent: form.intent.trim(),
          description: form.description.trim(),
          summaryMd: form.summaryMd.trim(),
        },
      },
      {
        onSuccess: () => closeEditor(),
        onError: (err) => setError(err instanceof Error ? err.message : "Edit failed."),
      },
    );
  }

  return (
    <>
      <RecipeCard
        recipe={recipe}
        taskTitleById={taskTitleById}
        footMetaAt={recipe.updatedAt}
        muted={muted}
        metaPills={
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px] font-mono text-ink-tertiary">
            <Pill>rev {recipe.rev}</Pill>
            <Pill>{recipe.status}</Pill>
            <Pill>{recipe.userEdited ? "provenance user" : "provenance agent"}</Pill>
            <Pill>applied {recipe.applicationCount}</Pill>
            <VerdictPills verdicts={recipe.verdicts} />
          </div>
        }
        actions={
          recipe.status === "active" ? (
            <>
              <Button variant="ghost" disabled={edit.isPending} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="ghost" disabled={retire.isPending} onClick={() => retire.mutate(recipe.id)}>
                Retire
              </Button>
            </>
          ) : canDeleteRecipe(recipe) ? (
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          ) : undefined
        }
      />
      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete recipe"
        description={guidance.messages.recipes.deleteDescription}
        descriptionLocale={guidance.locale}
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="text-sm text-ink">{recipe.title}</div>
          {remove.isError && (
            <div className="text-xs text-danger">
              {remove.error instanceof Error ? remove.error.message : "Delete failed."}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(recipe.id, { onSuccess: () => setConfirmingDelete(false) })
              }
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={editing}
        onClose={closeEditor}
        title="Edit recipe"
        description={guidance.messages.recipes.editDescription}
        descriptionLocale={guidance.locale}
      >
        <div className="p-4 flex flex-col gap-3">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              className={inputClassName}
              disabled={edit.isPending}
            />
          </Field>
          <Field label="Intent">
            <input
              value={form.intent}
              onChange={(e) => setForm((s) => ({ ...s, intent: e.target.value }))}
              className={inputClassName}
              disabled={edit.isPending}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              rows={3}
              className={inputClassName}
              disabled={edit.isPending}
            />
          </Field>
          <Field label="Summary">
            <textarea
              value={form.summaryMd}
              onChange={(e) => setForm((s) => ({ ...s, summaryMd: e.target.value }))}
              rows={8}
              className={inputClassName}
              disabled={edit.isPending}
            />
          </Field>
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={edit.isPending} onClick={closeEditor}>
              Cancel
            </Button>
            <Button variant="primary" disabled={edit.isPending} onClick={saveEdit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

// followed_and_helped/followed_not_helped/abandoned/unknown 중 0인 갈래는 접어 카드를 짧게 유지한다.
function VerdictPills({ verdicts }: { readonly verdicts: RecipeVerdictBreakdown }) {
  const entries: readonly [string, number][] = [
    ["helped", verdicts.followedAndHelped],
    ["not helped", verdicts.followedNotHelped],
    ["abandoned", verdicts.abandoned],
    ["unknown", verdicts.unknown],
  ];
  return (
    <>
      {entries
        .filter(([, count]) => count > 0)
        .map(([label, count]) => (
          <Pill key={label}>{label} {count}</Pill>
        ))}
    </>
  );
}

function Pill({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="py-px px-1.5 rounded-pill bg-s1 text-ink-tertiary font-mono">
      {children}
    </span>
  );
}

const inputClassName =
  "w-full bg-canvas border border-hair rounded-sm px-2.5 py-2 text-sm text-ink focus:outline-none focus:border-primary";
