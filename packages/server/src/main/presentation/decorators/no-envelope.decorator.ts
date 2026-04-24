import { SetMetadata } from "@nestjs/common";

export const NO_ENVELOPE_METADATA_KEY = "nestjs:no_envelope";

export const NoEnvelope = (): MethodDecorator & ClassDecorator => SetMetadata(NO_ENVELOPE_METADATA_KEY, true);
