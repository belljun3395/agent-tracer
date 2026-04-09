import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3999);
  console.log("NestJS PoC running on :3999");
  const res = await fetch("http://localhost:3999/health");
  console.log("Health check:", res.status, await res.json());
  await app.close();
}

bootstrap().catch(console.error);
