import { useLocation, useNavigate } from "react-router-dom";
import { ActivityIcon, BookIcon, ChecklistIcon, GearIcon, NoteIcon, Tooltip } from "~web/shared/ui/index.js";
import { useRecipesQuery } from "~web/entities/recipe/api/queries.js";
import { useRulesQuery } from "~web/entities/rule/api/queries.js";
import { useMemosQuery } from "~web/entities/memo/api/queries.js";
import { ThemeToggle } from "~web/widgets/topbar/ThemeToggle.js";
import { cn } from "~web/shared/ui/lib/cn.js";

/** 오른쪽 액션 영역. */
export function TopActions() {
  return (
    <div className="flex items-center gap-2">
      <RecipesButton />
      <RulesButton />
      <MemosButton />
      <JobsButton />
      <SettingsButton />
      <span aria-hidden className="w-px h-[18px] bg-hair" />
      <ThemeToggle />
    </div>
  );
}

function JobsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === "/jobs";
  return (
    <Tooltip content="Agent jobs" side="bottom">
      <button
        type="button"
        onClick={() => void navigate("/jobs")}
        aria-label="Agent jobs"
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-sm hover:bg-s1 transition-colors",
          active ? "text-ink bg-s1" : "text-ink-muted bg-transparent",
        )}
      >
        <ActivityIcon />
        <span className="text-xs font-medium tracking-[-0.05px]">
          Jobs
        </span>
      </button>
    </Tooltip>
  );
}

function RecipesButton() {
  const { data, isLoading } = useRecipesQuery();
  const navigate = useNavigate();
  const location = useLocation();
  const count = data?.recipes.length ?? 0;
  const active = location.pathname === "/recipes";
  return (
    <Tooltip content="Browse recipes" side="bottom">
      <button
        type="button"
        onClick={() => void navigate("/recipes")}
        aria-label="Browse recipes"
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-sm hover:bg-s1 transition-colors",
          active ? "text-ink bg-s1" : "text-ink-muted bg-transparent",
        )}
      >
        <BookIcon />
        <span className="text-xs font-medium tracking-[-0.05px]">
          Recipes
        </span>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-pill font-mono text-[10px] font-semibold px-1.5 min-w-5 leading-4",
            count > 0 ? "bg-ink-tertiary text-white" : "bg-s1 text-ink-tertiary",
          )}
        >
          {isLoading ? "…" : count}
        </span>
      </button>
    </Tooltip>
  );
}


function MemosButton() {
  const { data, isLoading } = useMemosQuery();
  const navigate = useNavigate();
  const location = useLocation();
  const count = data?.memos.length ?? 0;
  const active = location.pathname === "/memos";

  const onClick = () => {
    void navigate("/memos");
  };

  return (
    <Tooltip content="Browse memos" side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label="Browse memos"
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-sm hover:bg-s1 transition-colors",
          active ? "text-ink bg-s1" : "text-ink-muted bg-transparent",
        )}
      >
        <NoteIcon />
        <span className="text-xs font-medium tracking-[-0.05px]">
          Memos
        </span>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-pill font-mono text-[10px] font-semibold px-1.5 min-w-5 leading-4",
            count > 0 ? "bg-ink-tertiary text-white" : "bg-s1 text-ink-tertiary",
          )}
        >
          {isLoading ? "…" : count}
        </span>
      </button>
    </Tooltip>
  );
}

function SettingsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === "/settings";
  return (
    <Tooltip content="Settings" side="bottom">
      <button
        type="button"
        onClick={() => void navigate("/settings")}
        aria-label="Settings"
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-7 w-7 inline-flex items-center justify-center rounded-sm hover:bg-s1 transition-colors",
          active ? "text-ink bg-s1" : "text-ink-muted bg-transparent",
        )}
      >
        <GearIcon />
      </button>
    </Tooltip>
  );
}


function RulesButton() {
  const { data, isLoading } = useRulesQuery();
  const navigate = useNavigate();
  const location = useLocation();
  const count = data?.rules.length ?? 0;
  const active = location.pathname === "/rules";

  const onClick = () => {
    void navigate("/rules");
  };

  return (
    <Tooltip content="Manage rules" side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label="Manage rules"
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-sm hover:bg-s1 transition-colors",
          active ? "text-ink bg-s1" : "text-ink-muted bg-transparent",
        )}
      >
        <ChecklistIcon />
        <span className="text-xs font-medium tracking-[-0.05px]">
          Rules
        </span>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-pill font-mono text-[10px] font-semibold px-1.5 min-w-5 leading-4",
            count > 0 ? "bg-ink-tertiary text-white" : "bg-s1 text-ink-tertiary",
          )}
        >
          {isLoading ? "…" : count}
        </span>
      </button>
    </Tooltip>
  );
}
