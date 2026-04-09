# NestJS PoC Result

**Date:** 2026-04-09
**Branch:** main
**PoC location:** `packages/server/src/nestjs-poc/`

## Pass Criteria

> `GET /health` returns 200 with `{ status: "ok" }` when run from the PoC files.

**Result: PASSED**

## Approach That Worked

### tsx (Primary — WORKS)

```bash
cd packages/server
npx tsx --tsconfig src/nestjs-poc/tsconfig.json src/nestjs-poc/main.ts
```

Output:
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] AppModule dependencies initialized +7ms
[Nest] LOG [RoutesResolver] HealthController {/}: +1ms
[Nest] LOG [RouterExplorer] Mapped {/health, GET} route +1ms
[Nest] LOG [NestApplication] Nest application successfully started +0ms
NestJS PoC running on :3999
Health check: 200 { status: 'ok' }
```

tsx handles `experimentalDecorators` + `emitDecoratorMetadata` transparently via its own
transpilation pipeline without requiring a separate compilation step.

### tsc (Secondary — PARTIAL)

```bash
cd packages/server
npx tsc -p src/nestjs-poc/tsconfig.json --outDir dist/nestjs-poc --noEmit false
```

tsc compilation succeeds without errors. However, running the output with `node dist/nestjs-poc/main.js`
fails because the output is CommonJS (`module: "CommonJS"` in poc tsconfig) but
`packages/server/package.json` has `"type": "module"`, so Node.js treats `.js` as ESM.

**Workaround if tsc output is needed:** Use `--outExtension '.js:.cjs'` flag or run
with `node --input-type=commonjs`, or change output dir to a location with its own
`package.json` declaring `"type": "commonjs"`.

## Compatibility Issues Found

| Item | Status | Notes |
|------|--------|-------|
| ESM compatibility | OK | tsx handles the ESM/CJS boundary transparently |
| `experimentalDecorators` | OK | PoC tsconfig overrides base tsconfig; no conflicts |
| `emitDecoratorMetadata` | OK | Works with tsx; also works with tsc compilation |
| `reflect-metadata` | OK | Import at top of `main.ts` sufficient |
| better-sqlite3 + NestJS lifecycle | OK | `DatabaseProvider` with `useFactory` + `OnModuleDestroy` works |
| tsc → node (CJS output in ESM package) | ISSUE | `.js` output treated as ESM by Node; requires `.cjs` extension |

## tsconfig Fix Applied

The task spec used `"extends": "../../../tsconfig.base.json"`. The actual correct path
from `packages/server/src/nestjs-poc/` to the monorepo root is `../../../../tsconfig.base.json`
(four levels up, not three). This was corrected.

## Recommended Next Step

**Proceed with full NestJS migration using tsx as the runtime.**

- tsx already exists in the project devDependencies (`tsx watch` is used for `dev:server`)
- No additional tooling is needed
- The PoC confirms all four compatibility concerns (ESM, decorators, metadata, sqlite3) are resolved

If a compiled artifact is required (e.g., for Docker production builds), use one of the
fallback approaches from Phase 3.1:
1. Switch build from `tsup → tsc` with a CommonJS output target and then bundle
2. Use `--outExtension '.js:.cjs'` in tsc and update the entry point references
3. Add `esbuild-plugin-reflect-metadata` to tsup config for decorator metadata preservation

The lowest-friction production path is option 2 from Phase 3.1: switch the server build
from `tsup` to `tsc`, which gives full `emitDecoratorMetadata` support and produces
`.js` output that can be renamed `.cjs` or wrapped in a `package.json` with `"type": "commonjs"`.
