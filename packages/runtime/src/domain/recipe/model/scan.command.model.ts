/** 사용자가 세션 중 레시피 스캔을 요청하는 명령이다. */
const RECIPE_COMMAND = /^(?:\/(?:[\w-]+:)?recipe|\$recipe)(?:\s|$)/i;

export function hasRecipeScanCommand(prompt: string): boolean {
    return RECIPE_COMMAND.test(prompt.trimStart());
}

/** 명령 토큰 뒤에 남은 텍스트를 스캔 의도로 읽는다. */
export function readRecipeScanIntent(prompt: string): string | undefined {
    const trimmed = prompt.trimStart();
    const command = RECIPE_COMMAND.exec(trimmed);
    if (!command) return undefined;
    const intent = trimmed.slice(command[0].length).trim();
    return intent.length > 0 ? intent : undefined;
}
