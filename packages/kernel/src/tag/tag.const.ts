/** 색은 `#rrggbb` 소문자 여섯 자리로만 저장한다. */
export const TAG_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

export const TAG_NAME_MAX_LENGTH = 50;
export const TAG_DESCRIPTION_MAX_LENGTH = 200;

/** 태그를 만들 때 고를 수 있는 기본 색이며 이 목록 밖의 색도 허용된다. */
export const TAG_COLOR_PALETTE = [
    "#d73a4a",
    "#e99695",
    "#fbca04",
    "#0e8a16",
    "#006b75",
    "#1d76db",
    "#0052cc",
    "#5319e7",
    "#b60205",
    "#586069",
] as const;

export const TAG_DEFAULT_COLOR = "#586069";

/** 태스크 하나에 붙일 수 있는 태그의 수를 제한해 치환 요청이 무한히 커지지 않게 한다. */
export const TASK_TAGS_MAX_COUNT = 50;
