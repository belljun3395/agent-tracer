import {
  createGuidanceMessage,
  guidanceCode,
} from "~web/shared/guidance-message.js";

export const KO_FEED = {
  clickToRename: createGuidanceMessage("태스크 이름을 바꾸려면 클릭하세요."),
  suggestingTitle: createGuidanceMessage(
    "에이전트가 태스크 요약을 읽고 있습니다…",
  ),
  suggestBetterTitle: createGuidanceMessage(
    "태스크 요약을 바탕으로 더 명확한 제목을 생성합니다.",
  ),
  currentTitleFine: createGuidanceMessage(
    "현재 제목이 이미 적절해 새 제목을 제안하지 않았습니다.",
  ),
  wallClock: createGuidanceMessage(
    "태스크 세션이 시작된 뒤 흐른 실제 시간입니다.",
  ),
  compactions: createGuidanceMessage(
    "이 태스크에서 수행된 컨텍스트 창 압축 횟수입니다.",
  ),
  contextUsage: createGuidanceMessage(
    "상태 표시 스크립트가 마지막으로 보고한 컨텍스트 창 사용률입니다.",
  ),
  graphContext: createGuidanceMessage(
    "태스크 전체의 컨텍스트 창 사용률입니다. 점선은 경고(85%)와 오류(95%) 기준을 표시하며, 아래 띠는 사용 중이던 모델 계열을 보여줍니다.",
  ),
  graphNavigation: createGuidanceMessage(
    "Command 또는 Control을 누른 채 스크롤하면 확대하거나 축소할 수 있습니다. 빈 캔버스를 드래그하면 이동합니다.",
  ),
  emptyLanesHidden: (count: number) =>
    createGuidanceMessage(`이벤트가 없는 레인 ${count}개를 숨겼습니다.`),
  hideEmptyLanes: createGuidanceMessage(
    "이벤트가 없는 레인을 숨깁니다.",
  ),
  lanes: {
    user: createGuidanceMessage("사용자 프롬프트, 응답, 승인입니다."),
    plan: createGuidanceMessage("추론, 의도, 결정입니다."),
    explore: createGuidanceMessage("파일 읽기, 검색, 목록 조회입니다."),
    implement: createGuidanceMessage("파일 쓰기, 셸 명령, 편집입니다."),
    rule: createGuidanceMessage("규칙 트리거와 위반입니다."),
    verify: createGuidanceMessage("규칙 판정으로 확인된 작업입니다."),
    coordinate: createGuidanceMessage("서브에이전트 생성과 인계입니다."),
  },
} as const;

export const KO_TASKS = {
  cleanupIntroduction: createGuidanceMessage(
    "에이전트가 태스크 목록에서 중복, 오래된 항목, 보관할 만한 중단 태스크를 찾습니다. 모든 제안은 적용 전에 승인이 필요합니다.",
  ),
  cleanupEmpty: createGuidanceMessage(
    "대기 중인 보관 제안이 없습니다. 오래되거나 중복된 태스크를 찾으려면 스캔을 실행하세요.",
  ),
  taskView: createGuidanceMessage("운영자가 시작한 세션입니다."),
  subagentView: createGuidanceMessage("서버 에이전트가 시작한 잡입니다."),
  attentionFilter: createGuidanceMessage(
    "사용자 입력을 기다리거나 오류로 중단된 태스크입니다.",
  ),
  shortcutsHint: createGuidanceMessage(
    guidanceCode("?"),
    " 키를 누르면 단축키를 볼 수 있습니다. j/k는 이동, /는 검색, g는 Rules 열기, Esc는 지우기입니다.",
  ),
  runtimeCaption: (runtime: string) =>
    createGuidanceMessage(
      "이 목록의 모든 태스크는 ",
      guidanceCode(runtime),
      "에서 수집됐습니다.",
    ),
} as const;
