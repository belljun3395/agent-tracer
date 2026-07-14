import {
  createGuidanceMessage,
  guidanceCode,
  guidanceStrong,
} from "~web/shared/guidance-message.js";

export const KO_SETTINGS = {
  introduction: createGuidanceMessage(
    "서버 설정은 PostgreSQL에 저장됩니다. 민감한 값은 AES-256-GCM으로 암호화되며 저장 후에는 마스킹되어 표시됩니다. 값을 바꾸려면 새 값을 입력하세요.",
  ),
  securityNote: createGuidanceMessage(
    "민감한 설정은 ",
    guidanceCode("MONITOR_SETTINGS_ENCRYPTION_KEY"),
    "를 사용해 AES-256-GCM으로 암호화됩니다. 로컬 개발 이외의 환경에서는 이 키를 반드시 직접 설정하세요. 내장된 개발용 대체 키는 공유 환경이나 운영 환경에 적합하지 않습니다.",
  ),
  guidanceLanguage: createGuidanceMessage(
    "이 브라우저의 설명 문구 언어만 바꿉니다. 조작 버튼과 상태 레이블은 영어로 유지되며, 기록된 에이전트 콘텐츠는 원문 그대로 표시됩니다.",
  ),
  identityIntroduction: createGuidanceMessage(
    "태스크와 이벤트는 사용자별로 분류됩니다. 기본 ",
    guidanceCode("local"),
    " 신원은 설정할 필요가 없습니다. 이메일을 지정하면 이 브라우저 활동을 분리하고 Claude Code 훅 이벤트를 같은 사용자에게 연결할 수 있습니다.",
  ),
  identityStorage: createGuidanceMessage(
    "이 브라우저에만 저장됩니다. 값을 바꾸면 페이지가 새로고침됩니다.",
  ),
  identityReset: createGuidanceMessage(
    "이 브라우저의 사용자 신원을 지우고 ",
    guidanceCode("local"),
    " 사용자로 되돌립니다.",
  ),
  hookSetup: (email: string) =>
    createGuidanceMessage(
      "Claude Code 훅 이벤트를 ",
      guidanceStrong(email),
      " 사용자에게 연결하려면 이 값을 환경 설정에 추가하세요. 설정하지 않으면 훅 활동은 ",
      guidanceCode("local"),
      " 사용자로 기록됩니다.",
    ),
  ruleGenerationIntroduction: createGuidanceMessage(
    "공급자 인증 정보는 서버 AI 잡과 규칙 생성에 사용됩니다. API 키가 없다면 Claude Code에서 ",
    guidanceCode("/rule"),
    " 명령을 실행해 CLI 자체 인증으로 로컬 생성기를 사용할 수 있습니다.",
  ),
  anthropicApiKey: createGuidanceMessage(
    "Python LangGraph와 Claude SDK 백엔드에서 사용합니다.",
  ),
  anthropicModel: createGuidanceMessage(
    "Python LangGraph와 Claude SDK 백엔드에서 사용합니다.",
  ),
  maxRules: createGuidanceMessage(
    guidanceCode("/generate-rules"),
    "가 반환할 수 있는 최대 규칙 수입니다. 기본값은 5입니다.",
  ),
  outputLanguage: createGuidanceMessage(
    "제목 제안과 정리 제안 등 지원되는 AI 생성 결과의 선호 언어를 지정합니다. 개별 잡이나 프롬프트가 이 값을 덮어쓸 수 있으며, 현재 레시피 생성에는 이 전역 설정이 적용되지 않습니다. 지원되는 경우 Auto는 원본 태스크의 언어를 따릅니다.",
  ),
} as const;
