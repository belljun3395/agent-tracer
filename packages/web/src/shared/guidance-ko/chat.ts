import {
  createGuidanceMessage,
} from "~web/shared/guidance-message.js";

export const KO_CHAT = {
  workspaceIntroduction: createGuidanceMessage(
    "태스크, 규칙, 메모, 레시피에 대해 에이전트에게 물어보거나, 대신 변경을 맡기세요.",
  ),
  loadError: createGuidanceMessage("모니터 서버 연결을 확인하세요."),
  threadsEmpty: createGuidanceMessage(
    "아직 대화가 없습니다. New thread로 시작하세요.",
  ),
  conversationEmpty: createGuidanceMessage(
    "메시지를 보내 이 대화를 시작하세요.",
  ),
  selectThread: createGuidanceMessage(
    "대화를 선택하거나 새로 시작하세요.",
  ),
  streamError: createGuidanceMessage(
    "대화 스트림이 예기치 않게 끊겼습니다. 다시 보내 보세요.",
  ),
  confirmDescription: createGuidanceMessage(
    "에이전트가 데이터를 바꾸는 작업을 제안했습니다. 승인하면 실행되고, 거절하면 실행되지 않습니다.",
  ),
  memoryUpdated: createGuidanceMessage(
    "에이전트가 앞으로의 대화를 위해 이 내용을 기억했습니다.",
  ),
  deleteConfirm: createGuidanceMessage(
    "이 대화와 모든 메시지를 완전히 지웁니다. 되돌릴 수 없습니다.",
  ),
  thinking: createGuidanceMessage("생각 중…"),
  toolRunning: createGuidanceMessage("실행 중"),
  queuedToSend: createGuidanceMessage("대기 중"),
} as const;
