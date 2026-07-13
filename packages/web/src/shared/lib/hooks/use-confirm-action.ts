import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_ARM_TIMEOUT_MS = 3500;

interface UseConfirmActionOptions {
  readonly timeoutMs?: number;
}

interface UseConfirmActionResult {
  /** armed 상태인 동안 다음 trigger() 호출이 액션을 실행한다. */
  readonly armed: boolean;
  /** 첫 호출은 armed로 만들고, armed 상태에서의 다음 호출이 액션을 실행하고 해제한다. */
  readonly trigger: () => void;
  /** 명시적으로 해제한다. */
  readonly disarm: () => void;
}

/**
 * 파괴적인 row 액션(태스크 삭제, 규칙 삭제, 보관) 전부가 쓰는 2클릭
 * 확인 패턴.
 */
export function useConfirmAction(
  action: () => void,
  { timeoutMs = DEFAULT_ARM_TIMEOUT_MS }: UseConfirmActionOptions = {},
): UseConfirmActionResult {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const disarm = useCallback(() => {
    clearTimer();
    setArmed(false);
  }, [clearTimer]);

  const trigger = useCallback(() => {
    if (!armed) {
      setArmed(true);
      clearTimer();
      timerRef.current = setTimeout(() => setArmed(false), timeoutMs);
      return;
    }
    clearTimer();
    setArmed(false);
    action();
  }, [armed, action, clearTimer, timeoutMs]);

  useEffect(() => clearTimer, [clearTimer]);

  return { armed, trigger, disarm };
}
