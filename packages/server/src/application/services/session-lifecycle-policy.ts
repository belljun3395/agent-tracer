/**
 * @module application/services/session-lifecycle-policy
 *
 * 세션 생명주기 정책 - 태스크 자동 완료 여부를 결정한다.
 */

export function shouldAutoCompleteBackground(opts: {
  taskKind: string;
  runningSessionCount: number;
}): boolean {
  return opts.taskKind === "background" && opts.runningSessionCount === 0;
}

export function shouldAutoCompletePrimary(opts: {
  taskKind: string;
  completeTask: boolean;
  runningSessionCount: number;
  completionReason?: string | undefined;
  hasRunningBackgroundDescendants?: boolean | undefined;
}): boolean {
  if (opts.taskKind !== "primary") return false;
  if (!opts.completeTask) return false;
  if (opts.runningSessionCount !== 0) return false;
  if (opts.completionReason === "assistant_turn_complete" && opts.hasRunningBackgroundDescendants) {
    return false;
  }
  return true;
}

export function shouldMovePrimaryToWaiting(opts: {
  taskKind: string;
  completeTask: boolean;
  runningSessionCount: number;
  completionReason?: string | undefined;
  hasRunningBackgroundDescendants?: boolean | undefined;
}): boolean {
  if (opts.taskKind !== "primary") return false;
  if (opts.runningSessionCount !== 0) return false;
  if (opts.completionReason === "idle") {
    return opts.completeTask !== true;
  }
  if (opts.completionReason === "assistant_turn_complete" && opts.hasRunningBackgroundDescendants) {
    return true;
  }
  if (opts.hasRunningBackgroundDescendants) return false;
  if (opts.completeTask) return false;
  return false;
}
