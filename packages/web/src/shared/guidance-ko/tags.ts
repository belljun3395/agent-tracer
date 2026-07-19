import { createGuidanceMessage } from "~web/shared/guidance-message.js";

export const KO_TAGS = {
  workspaceIntroduction: createGuidanceMessage(
    "태스크에 붙여 분류하는 라벨이며, 이 워크스페이스를 보는 모든 운영자에게 보입니다.",
  ),
  loadError: createGuidanceMessage("모니터 서버 연결을 확인하세요."),
  workspaceEmpty: createGuidanceMessage(
    "아직 태그가 없습니다. 태그를 만들어 태스크를 분류하세요.",
  ),
  createDescription: createGuidanceMessage(
    "이름과 색을 정해 새 태그를 만듭니다.",
  ),
  editDescription: createGuidanceMessage(
    "태그의 이름과 색과 설명을 수정합니다.",
  ),
  deleteDescription: createGuidanceMessage(
    "확인하면 태그가 삭제되고 붙어 있던 모든 태스크에서 떨어집니다.",
  ),
  taskAssignDescription: createGuidanceMessage(
    "이 태스크에 붙일 태그를 고르거나 새 태그를 만듭니다.",
  ),
  filterDescription: createGuidanceMessage(
    "선택한 태그를 모두 가진 태스크만 남깁니다.",
  ),
} as const;
