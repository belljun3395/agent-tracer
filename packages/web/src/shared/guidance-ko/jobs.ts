import {
  createGuidanceMessage,
} from "~web/shared/guidance-message.js";

export const KO_JOBS = {
  introduction: createGuidanceMessage(
    "최근 생성된 순서입니다. 실행 결과와 진단 이력을 확인할 수 있습니다.",
  ),
  resetFilters: createGuidanceMessage(
    "전체 이력을 보려면 필터를 초기화하세요.",
  ),
  cancel: createGuidanceMessage(
    "실행 중인 에이전트 호출이 즉시 중단됩니다. 되돌릴 수 없습니다.",
  ),
  trajectoryIntroduction: createGuidanceMessage(
    "에이전트가 결과를 만드는 동안 기록된 실행 단계입니다.",
  ),
  trajectoryAttempt: createGuidanceMessage("시도"),
  rawDataIntroduction: createGuidanceMessage(
    "재현과 진단을 위한 서버 데이터입니다. 일반적인 결과 확인에는 Overview를 사용하세요.",
  ),
  noTargetTask: createGuidanceMessage(
    "이 잡에는 대상 태스크가 없어 제안을 적용할 수 없습니다.",
  ),
  noTitleSuggestions: createGuidanceMessage(
    "이 잡에는 적용할 수 있는 제목 제안이 없습니다.",
  ),
  loadingCleanupSuggestions: createGuidanceMessage(
    "정리 제안을 불러오는 중입니다…",
  ),
  noCleanupSuggestions: createGuidanceMessage(
    "이 잡에서 생성된 정리 제안이 없습니다.",
  ),
  trajectoryAfterCompletion: createGuidanceMessage(
    "잡이 끝나면 실행 궤적이 표시됩니다.",
  ),
  loadingTrajectory: createGuidanceMessage("실행 궤적을 불러오는 중입니다…"),
  trajectoryUnavailable: createGuidanceMessage(
    "실행 궤적을 불러오지 못했습니다.",
  ),
  noTrajectory: createGuidanceMessage(
    "이 잡에 기록된 실행 궤적이 없습니다.",
  ),
} as const;
