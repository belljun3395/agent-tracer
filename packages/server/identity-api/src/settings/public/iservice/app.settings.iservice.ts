/**
 * Public settings read contract consumed by other packages (LLM agent config 등).
 * 쓰기/마스킹은 settings 컨트롤러 내부용이라 공개하지 않는다.
 */
export interface IAppSettings {
    getRawValue(key: string): Promise<string | null>;
    getAnthropicApiKey(): Promise<string | null>;
    getAnthropicModel(): Promise<string | null>;
}
