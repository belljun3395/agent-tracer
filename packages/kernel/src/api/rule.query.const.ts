/** 규칙 목록 조회의 HTTP 계약이며 데몬 클라이언트와 서버 컨트롤러가 같은 값을 읽는다. */
export const RULES_PATH = "/api/v1/rules";

/** 태스크를 가리지 않고 이 사용자의 규칙 전부를 달라는 플래그다. */
export const RULES_ALL_FLAG = "all";
export const RULES_ALL_FLAG_VALUE = "true";

export const RULES_ALL_PATH = `${RULES_PATH}?${RULES_ALL_FLAG}=${RULES_ALL_FLAG_VALUE}`;
