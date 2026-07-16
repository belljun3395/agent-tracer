import { createGuidanceMessage } from "~web/shared/guidance-message.js";

export const KO_MEMOS = {
  workspaceIntroduction: createGuidanceMessage(
    "태스크나 개별 이벤트에 매단 메모이며, 이 워크스페이스를 보는 모든 운영자에게 보입니다.",
  ),
  loadError: createGuidanceMessage("모니터 서버 연결을 확인하세요."),
  workspaceEmpty: createGuidanceMessage(
    "아직 메모가 없습니다. 태스크를 열어 첫 메모를 남기세요.",
  ),
  taskThreadEmpty: createGuidanceMessage(
    "아직 이 태스크에 메모가 없습니다. 아래에서 추가하세요.",
  ),
  eventThreadEmpty: createGuidanceMessage(
    "아직 이 이벤트에 메모가 없습니다. 아래에서 추가하세요.",
  ),
  editDescription: createGuidanceMessage("메모 본문을 수정합니다."),
  deleteDescription: createGuidanceMessage(
    "확인하면 메모가 영구히 삭제됩니다.",
  ),
} as const;
