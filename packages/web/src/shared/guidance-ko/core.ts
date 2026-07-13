import {
  createGuidanceMessage,
  guidanceCode,
} from "~web/shared/guidance-message.js";

export const KO_COMMON = {
  guidanceUnavailable: createGuidanceMessage(
    "이 화면에 대한 설명은 아직 제공되지 않습니다.",
  ),
  runCommandToContinue: (command: string) =>
    createGuidanceMessage(
      "계속하려면 ",
      guidanceCode(command),
      " 명령을 실행하세요.",
    ),
  status: {
    running: createGuidanceMessage("에이전트가 이벤트를 생성하고 있습니다."),
    waiting: createGuidanceMessage("에이전트가 사용자 입력을 기다리고 있습니다."),
    done: createGuidanceMessage("태스크가 정상적으로 완료됐습니다."),
    failed: createGuidanceMessage("태스크가 오류로 종료됐습니다."),
    idle: createGuidanceMessage("최근 활동이 기록되지 않았습니다."),
    canceled: createGuidanceMessage("잡이 완료되기 전에 중단됐습니다."),
  },
} as const;

export const KO_APP = {
  crashRecovery: createGuidanceMessage(
    "대부분은 새로고침하면 복구됩니다. 오류가 반복되면 위 메시지를 버그 보고서에 복사하세요. 운영 중인 URL과 오류 메시지만으로도 대개 원인을 파악할 수 있습니다.",
  ),
  noTaskSelected: createGuidanceMessage(
    "각 태스크에는 에이전트의 모든 작업이 시간순으로 모입니다. 실행 과정을 보려면 태스크를 여세요.",
  ),
  taskNotFound: createGuidanceMessage(
    "다른 탭에서 삭제됐거나 오래된 ID를 가리키는 링크일 수 있습니다.",
  ),
  taskServerUnavailable: createGuidanceMessage(
    "모니터 서버가 응답하지 않았습니다. 설정된 포트에서 실행 중인지 확인한 뒤 다시 시도하세요.",
  ),
  eventsPending: createGuidanceMessage(
    "에이전트가 실행되면 이벤트가 여기에 표시됩니다.",
  ),
} as const;

export const KO_SHELL = {
  shortcutToggle: createGuidanceMessage(
    "언제든 ",
    guidanceCode("?"),
    " 키를 눌러 이 패널을 열거나 닫을 수 있습니다.",
  ),
  shortcuts: {
    focusSearch: createGuidanceMessage("사이드바 검색창으로 이동합니다."),
    nextTask: createGuidanceMessage("다음 태스크로 이동합니다."),
    previousTask: createGuidanceMessage("이전 태스크로 이동합니다."),
    rulesPage: createGuidanceMessage("워크스페이스 규칙 화면을 엽니다."),
    dismiss: createGuidanceMessage("검색어를 지우거나 열린 서랍을 닫습니다."),
    showPanel: createGuidanceMessage("단축키 패널을 열거나 닫습니다."),
  },
  websocketDisconnected: createGuidanceMessage(
    "대시보드가 WebSocket 이벤트를 받지 못하고 있습니다. 모니터 서버가 복구되면 업데이트가 재개됩니다.",
  ),
  websocketConnected: createGuidanceMessage(
    "모니터 WebSocket에 연결됐습니다. 태스크와 이벤트 변경이 실시간으로 반영됩니다.",
  ),
} as const;
