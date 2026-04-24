import { Module } from "@nestjs/common";
import { APPLICATION_PROVIDERS, APPLICATION_PROVIDER_TOKENS } from "./application.providers.js";

@Module({
    providers: APPLICATION_PROVIDERS,
    exports: [...APPLICATION_PROVIDER_TOKENS],
})
export class ApplicationModule {}
