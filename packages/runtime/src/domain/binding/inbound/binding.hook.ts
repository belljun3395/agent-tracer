import type {BoundSession, ReadBindingUsecase} from "~runtime/domain/binding/application/read.binding.usecase.js";
import type {ReleaseBindingUsecase} from "~runtime/domain/binding/application/release.binding.usecase.js";

/** 바인딩 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface BindingHook {
    readonly readBinding: ReadBindingUsecase;
    readonly releaseBinding: ReleaseBindingUsecase;
}

export function onBindingLookup(
    hook: BindingHook,
    runtimeSource: string,
    runtimeSessionId: string,
): BoundSession | undefined {
    return hook.readBinding.execute(runtimeSource, runtimeSessionId);
}

export function onBindingRelease(
    hook: BindingHook,
    runtimeSource: string,
    runtimeSessionId: string,
): Promise<boolean> {
    return hook.releaseBinding.execute(runtimeSource, runtimeSessionId);
}
