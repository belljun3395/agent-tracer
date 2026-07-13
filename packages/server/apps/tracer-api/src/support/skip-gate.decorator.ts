import { SetMetadata } from "@nestjs/common";

export const SKIP_GATE_METADATA_KEY = "monitor:skip_gate";

/** 헬스 프로브와 세션 발급처럼 신원 없이 닿아야 하는 경로에서만 인증·레이트리밋 가드를 우회한다. */
export const SkipGate = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_GATE_METADATA_KEY, true);
