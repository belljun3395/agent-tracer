import { useState } from "react";
import type { ResumeTargetDto } from "@monitor/kernel";
import { openResumeSession } from "~web/features/task-resume/api/open-resume-session.js";
import { CheckIcon, CopyIcon, MonitorIcon, Tooltip } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface SessionIdPillProps {
  readonly resumeTarget: ResumeTargetDto;
}

type ResumeButtonState = "idle" | "opening" | "opened" | "copied" | "failed";

export function SessionIdPill({ resumeTarget }: SessionIdPillProps) {
  const [state, setState] = useState<ResumeButtonState>("idle");
  const short = resumeTarget.runtimeSessionId.slice(-8);

  const onClick = async () => {
    if (state === "opening") return;
    setState("opening");
    try {
      const result = await openResumeSession(resumeTarget);
      setState(result.status);
      window.setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 1500);
    }
  };

  const done = state === "opened" || state === "copied";
  const title =
    state === "opened"
      ? "Resume opened"
      : state === "copied"
        ? "Helper unavailable · command copied"
        : state === "failed"
          ? "Resume failed"
          : `Resume ${resumeTarget.runtimeSource} session ${resumeTarget.runtimeSessionId}`;

  return (
    <Tooltip
      content={title}
      side="bottom"
    >
      <button
        type="button"
        onClick={() => void onClick()}
        aria-label={`Resume session ${resumeTarget.runtimeSessionId}`}
        disabled={state === "opening"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill px-2 py-[2px] bg-transparent tracking-normal",
          "font-mono text-[10.5px] transition-colors duration-150 border",
          done
            ? "text-ok border-ok"
            : state === "failed"
              ? "text-err border-err"
              : "text-ink-subtle border-hair",
        )}
      >
        <span className="text-ink-tertiary">resume</span>
        <span>{short}</span>
        {done ? <CheckIcon /> : state === "failed" ? <CopyIcon /> : <MonitorIcon size={11} />}
      </button>
    </Tooltip>
  );
}
