const SYSTEM_NOTIFICATION_PREFIX = "<task-notification>";

/** 트림한 프롬프트가 시스템이 주입한 알림 텍스트로 시작하면 사용자가 직접 쓴 발화가 아니다. */
export function isSystemNotificationPrompt(prompt: string): boolean {
    return prompt.trim().startsWith(SYSTEM_NOTIFICATION_PREFIX);
}
