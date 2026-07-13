import { describe, expect, it } from "vitest";
import type { Provider } from "@nestjs/common";
import { TracerApiModule } from "./tracer.api.module.js";

// vitest는 vite의 import.meta.glob을 제공하지만 이 패키지 tsconfig에는 vite 타입이 없다.
type GlobbingImportMeta = ImportMeta & {
    glob(pattern: string, options: { eager: true }): Record<string, Record<string, unknown>>;
};

const portModules = (import.meta as GlobbingImportMeta).glob("./domain/**/*.port.ts", { eager: true });

function providedTokens(providers: readonly Provider[]): ReadonlySet<unknown> {
    return new Set(providers.map((p) => (typeof p === "object" && "provide" in p ? p.provide : p)));
}

function declaredPortTokens(): ReadonlyMap<symbol, string> {
    const tokens = new Map<symbol, string>();
    for (const [file, exports] of Object.entries(portModules)) {
        for (const [name, value] of Object.entries(exports)) {
            if (typeof value === "symbol") tokens.set(value, `${file} → ${name}`);
        }
    }
    return tokens;
}

describe("TracerApiModule", () => {
    it("application 포트가 선언한 주입 토큰을 모두 배선한다", () => {
        const module = TracerApiModule.forRoot(undefined as never, undefined as never, undefined as never);
        const provided = providedTokens(module.providers ?? []);

        const unwired = [...declaredPortTokens()]
            .filter(([token]) => !provided.has(token))
            .map(([, where]) => where);

        expect(unwired).toEqual([]);
    });
});
