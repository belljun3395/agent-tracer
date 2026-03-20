/**
 * @module path-utils
 *
 * 파일 경로 추출·정규화·매칭 유틸리티.
 * 서버(user.message filePaths 파생)와 웹(@ 멘션 검증) 양쪽에서 공유.
 */

/**
 * 텍스트에서 경로처럼 생긴 토큰을 추출한다.
 * 백틱 내 경로, @ 접두사 경로(파일·폴더 모두), 일반 경로 패턴을 순서대로 시도.
 *
 * @param text - 추출할 원본 텍스트
 * @returns 중복 제거된 경로 후보 배열 (trailing slash 보존)
 */
export function extractPathLikeTokens(text: string): readonly string[] {
  const matches = new Set<string>();

  function addCandidate(raw: string | undefined): void {
    const candidate = raw?.trim().replace(/\/$/, "");
    if (candidate && looksLikePath(candidate)) {
      matches.add(candidate);
    }
  }

  // fenced code block(``` ... ```)을 제거해 코드 내용이 경로로 오탐되는 것을 방지.
  const stripped = text.replace(/```[\s\S]*?```/g, "");

  // 백틱 내 경로: `src/components/` 또는 `src/foo.ts`
  // 개행을 포함하면 코드블록 잔여물이므로 제외.
  const backtickRegex = /`([^`\n]+)`/g;
  for (const match of stripped.matchAll(backtickRegex)) {
    addCandidate(match[1]);
  }

  // @ 접두사 경로: trailing slash 포함 → 폴더도 캡처
  const atPathRegex = /@([A-Za-z0-9_./-]+\/?)/g;
  for (const match of stripped.matchAll(atPathRegex)) {
    addCandidate(match[1]);
  }

  // 일반 경로 패턴 (슬래시 포함 세그먼트)
  const plainPathRegex = /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]*/g;
  for (const match of stripped.matchAll(plainPathRegex)) {
    addCandidate(match[0]);
  }

  return [...matches];
}

/**
 * 문자열이 파일 경로처럼 생겼는지 판별.
 * 슬래시를 포함하거나 확장자처럼 보이는 suffix가 있으면 경로로 간주.
 * dotfile (.gitignore, .env, .prettierrc)도 파일 경로로 인식.
 */
export function looksLikePath(value: string): boolean {
  if (/[\n\r]/.test(value)) return false;
  if (value.length > 260) return false;
  if (/\s/.test(value)) return false;
  if (/[=(){};,\x5b\x5d<>!?#&|+*^~"']/.test(value)) return false;

  return (
    /[/\\]/.test(value) ||
    /\.[a-z0-9]{1,15}$/i.test(value) ||
    /^\.[a-z0-9]/i.test(value)
  );
}

/**
 * 경로가 디렉토리(폴더)를 가리키는지 판별.
 * - trailing slash 있음: 명확히 폴더
 * - dotfile (.gitignore, .env): 파일로 간주
 * - 확장자 없음: 폴더로 간주
 * - 확장자 있음: 파일로 간주
 */
export function isDirectoryPath(path: string): boolean {
  if (path.endsWith("/")) {
    return true;
  }
  const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
  if (/^\.[a-z0-9]/i.test(lastSegment)) {
    return false;
  }
  return !/\.[a-z0-9]{1,15}$/i.test(lastSegment);
}

/**
 * 파일 경로를 정규화한다.
 * - 절대 경로는 그대로 유지
 * - 상대 경로는 workspacePath가 제공될 때 절대 경로로 변환 시도
 * - 중복 슬래시, trailing slash 정리
 */
export function normalizeFilePath(
  filePath: string,
  workspacePath?: string
): string {
  const cleaned = filePath.replace(/\/+/g, "/").replace(/\/$/, "").trim();

  if (cleaned.startsWith("/")) {
    return cleaned;
  }

  if (workspacePath) {
    const base = workspacePath.replace(/\/+/g, "/").replace(/\/$/, "");
    return `${base}/${cleaned}`;
  }

  return cleaned;
}

/**
 * 두 경로가 같은 파일을 가리키는지 비교.
 * 절대/상대 경로 혼재를 처리하기 위해 경로 suffix 매칭을 사용.
 *
 * 예시:
 * - "src/foo.ts" vs "/Users/x/project/src/foo.ts" → true
 * - "/a/b/c.ts" vs "/a/b/c.ts" → true
 */
export function matchFilePaths(
  mentionedPath: string,
  exploredPath: string,
  workspacePath?: string
): boolean {
  const normalizedMentioned = normalizeFilePath(mentionedPath, workspacePath);
  const normalizedExplored = normalizeFilePath(exploredPath, workspacePath);

  if (normalizedMentioned === normalizedExplored) {
    return true;
  }

  const suffixA = toPathSuffix(normalizedMentioned);
  const suffixB = toPathSuffix(normalizedExplored);

  if (suffixA && suffixB) {
    return suffixA === suffixB
      || suffixB.endsWith(`/${suffixA}`)
      || suffixA.endsWith(`/${suffixB}`);
  }

  return false;
}

/**
 * 폴더 경로 아래에 속하는 파일 경로 목록을 반환한다.
 * 상대·절대 경로 혼재를 처리.
 *
 * 예시:
 * - dirPath="src/components", filePaths=["/Users/x/src/components/Button.tsx"] → match
 * - dirPath="packages/web/src/", filePaths=["packages/web/src/lib/foo.ts"] → match
 *
 * @param dirPath - 폴더 경로 (상대 또는 절대)
 * @param filePaths - 검사할 파일 경로 목록
 * @param workspacePath - 정규화 기준 워크스페이스 경로 (선택적)
 * @returns dirPath 아래에 속하는 파일 경로 배열
 */
export function filePathsInDirectory(
  dirPath: string,
  filePaths: readonly string[],
  workspacePath?: string
): readonly string[] {
  const normalizedDir = normalizeFilePath(dirPath, workspacePath);
  const dirSuffix = toPathSuffix(normalizedDir);

  return filePaths.filter((filePath) => {
    const normalizedFile = normalizeFilePath(filePath, workspacePath);
    const fileSuffix = toPathSuffix(normalizedFile);

    // 1. 디렉토리 자체가 탐색된 경우 (ls / tree 류 도구가 폴더 경로를 기록할 때)
    if (fileSuffix === dirSuffix || normalizedFile === normalizedDir) {
      return true;
    }

    // 2. 폴더 하위 파일: prefix + 세그먼트 경계 확인
    return fileSuffix.startsWith(`${dirSuffix}/`)
      || normalizedFile.startsWith(`${normalizedDir}/`);
  });
}

function toPathSuffix(p: string): string {
  return p.replace(/^\/+/, "");
}
