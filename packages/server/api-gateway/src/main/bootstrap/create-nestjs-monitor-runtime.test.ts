import { describe, expect, it } from "vitest";

import * as runtimeModule from "./create-nestjs-monitor-runtime.js";

const originAllowed = (runtimeModule as {
    readonly isLocalOriginAllowed?: (origin: string | undefined) => boolean;
}).isLocalOriginAllowed;

describe("local origin policy", () => {
    it("allows IPv6 localhost origins", () => {
        expect(originAllowed).toBeTypeOf("function");
        expect(originAllowed?.("http://[::1]:5173")).toBe(true);
    });
});
