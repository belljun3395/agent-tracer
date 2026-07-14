import {
  createGuidanceMessage,
  guidanceCode,
} from "~web/shared/guidance-message.js";

export const KO_RULES = {
  workspaceIntroduction: createGuidanceMessage(
    "워크스페이스 전체의 에이전트 이벤트를 평가하는 검사를 만들고 관리합니다.",
  ),
  loadError: createGuidanceMessage("모니터 서버 연결을 확인하세요."),
  emptyTask: createGuidanceMessage(
    "이 태스크에 검사를 적용하려면 규칙을 추가하세요.",
  ),
  workspaceEmpty: createGuidanceMessage(
    "설정된 규칙이 없습니다. 위에서 첫 규칙을 만드세요.",
  ),
  editDescription: createGuidanceMessage(
    "규칙의 기대 동작, 심각도, 근거를 수정합니다.",
  ),
  newTaskDescription: createGuidanceMessage(
    "이 태스크의 이벤트를 검사하는 새 규칙을 정의합니다.",
  ),
  newWorkspaceDescription: createGuidanceMessage(
    "에이전트 이벤트를 검사하는 새 규칙을 정의합니다.",
  ),
  form: {
    nameRequired: createGuidanceMessage("규칙 이름을 입력하세요."),
    expectationRequired: createGuidanceMessage(
      "선택한 Kind가 요구하는 필드를 채우세요.",
    ),
    anchor: createGuidanceMessage(
      "이 규칙이 검증할 사용자 발화입니다. 이 발화 이후 에이전트가 한 일로 이행 여부를 판정합니다.",
    ),
    anchorRequired: createGuidanceMessage(
      "규칙이 검증할 사용자 발화를 고르세요.",
    ),
    expectation: createGuidanceMessage(
      "사용자의 요구를 이행하려면 에이전트가 무엇을 해야 하는지 정의하세요. Kind가 아래 필드 조합을 정합니다.",
    ),
    kind: createGuidanceMessage(
      "기대의 종류입니다. command는 명령 일치, pattern은 정규식, action은 도구 범주를 씁니다.",
    ),
    toolName: createGuidanceMessage(
      "action에서는 필수, pattern에서는 검사 대상을 좁히는 선택 항목입니다.",
    ),
    commandMatches: createGuidanceMessage(
      "예상되는 명령 문자열을 한 줄에 하나씩 입력하세요.",
    ),
    pattern: createGuidanceMessage(
      "이벤트 페이로드에 적용할 정규식입니다.",
    ),
    rationale: createGuidanceMessage(
      "이 규칙이 필요한 이유를 설명하세요. 위반 카드에 표시됩니다.",
    ),
  },
  generation: {
    introduction: createGuidanceMessage(
      "Claude Agent SDK가 이 태스크의 워크스페이스와 타임라인을 분석해 검증 규칙을 제안합니다. 생성된 규칙은 ",
      guidanceCode("source=agent"),
      "와 ",
      guidanceCode("severity=info"),
      "로 저장됩니다.",
    ),
    incompleteTimeline: (status: string) =>
      createGuidanceMessage(
        "태스크 상태가 ",
        guidanceCode(status),
        "이므로 타임라인이 완전하지 않을 수 있습니다.",
      ),
    anchorHelp: createGuidanceMessage(
      "규칙은 이 입력을 근거로 만들어지고, 이 입력 이후 에이전트가 한 일로 이행 여부를 판정합니다. 발화 하나에 규칙이 여럿 붙을 수 있습니다.",
    ),
    intentHelp: createGuidanceMessage(
      "규칙이 검증할 내용을 선택적으로 설명하세요. 비워 두면 태스크 전체를 스캔합니다.",
    ),
  },
  feedback: {
    prompt: createGuidanceMessage("이 규칙은 얼마나 유용했나요?"),
    saveFailed: createGuidanceMessage("평가를 저장하지 못했습니다."),
    saved: createGuidanceMessage("평가를 저장했습니다."),
  },
  evidence: {
    loading: createGuidanceMessage("규칙 근거를 불러오는 중입니다…"),
    unavailable: createGuidanceMessage(
      "이 규칙의 근거를 불러오지 못했습니다.",
    ),
    empty: createGuidanceMessage(
      "아직 이 태스크에서 규칙과 일치한 이벤트가 없습니다.",
    ),
    unfulfilled: createGuidanceMessage(
      "사용자의 요구 이후 이 규칙이 기대한 행동이 실행되지 않았습니다.",
    ),
    matchedTrigger: createGuidanceMessage(
      "이 규칙을 낳은 사용자 발화입니다.",
    ),
    matchedCondition: (condition: string) =>
      createGuidanceMessage(
        "규칙의 ",
        guidanceCode(condition),
        " 조건과 일치했습니다.",
      ),
  },
} as const;

export const KO_RECIPES = {
  introduction: createGuidanceMessage(
    "완료된 태스크에서 추출한 재사용 패턴입니다. 각 후보는 검토를 거쳐야 이후 에이전트가 사용할 수 있는 활성 레시피가 됩니다.",
  ),
  candidatesEmpty: createGuidanceMessage(
    "검토할 후보가 없습니다. 완료된 태스크를 스캔해 재사용 패턴을 추출하세요.",
  ),
  activeEmpty: createGuidanceMessage(
    "활성 레시피가 없습니다. 후보를 승인해 추가하세요.",
  ),
  archiveEmpty: createGuidanceMessage(
    "폐기되거나 다른 버전으로 대체된 레시피가 이 보관함에 표시됩니다.",
  ),
  completedTasksEmpty: createGuidanceMessage(
    "완료된 태스크가 없습니다. 태스크를 끝낸 뒤 스캔하세요.",
  ),
  taskSearchEmpty: (query: string) =>
    createGuidanceMessage(
      guidanceCode(query),
      "와 일치하는 완료 태스크가 없습니다.",
    ),
  deleteDescription: createGuidanceMessage(
    "레시피가 보관함에서 제거됩니다. 적용 이력은 지표 계산을 위해 유지됩니다.",
  ),
  editDescription: createGuidanceMessage(
    "사용자가 편집한 레시피에 대한 이후 에이전트 업데이트는 검토 후보로 도착합니다.",
  ),
} as const;

export const KO_INSPECTOR = {
  selectAction: createGuidanceMessage(
    "전체 페이로드를 보려면 타임라인 카드를 선택하세요.",
  ),
  traceLoadError: createGuidanceMessage(
    "모니터 서버 연결을 확인하거나 다른 태스크를 선택하세요.",
  ),
  tracePending: createGuidanceMessage(
    "에이전트가 실행되면 스팬이 여기에 표시됩니다.",
  ),
  spanKinds: {
    llm: createGuidanceMessage("언어 모델에 프롬프트를 보낸 모델 호출입니다."),
    tool: createGuidanceMessage("Bash나 Edit 같은 작업을 실행한 도구 호출입니다."),
    agent: createGuidanceMessage("다른 에이전트에게 작업을 넘긴 서브에이전트 위임입니다."),
    retriever: createGuidanceMessage("문서나 메모리 저장소에서 정보를 조회한 작업입니다."),
    chain: createGuidanceMessage("하나 이상의 하위 스팬을 묶는 워크플로 단계입니다."),
    unknown: createGuidanceMessage("컨텍스트, 알림, 기타 텔레메트리 이벤트입니다."),
  },
} as const;
