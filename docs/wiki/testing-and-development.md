# Testing & Development

This document is a development starting point that organizes the most frequently used commands when modifying Agent Tracer
and clarifies what kinds of tests exist and where.

## Root Commands

```bash
npm run build
npm run lint
npm test
npm run dev
```

## Per-Package Commands

- `@monitor/core`: `npm run test --workspace @monitor/core`
- `@monitor/server`: `npm run test --workspace @monitor/server`
- `@monitor/adapter-mcp`: `npm run test --workspace @monitor/adapter-mcp`
- `@monitor/web-app`: `npm run test --workspace @monitor/web-app`

## Common Development Loops

### Local App Development

```bash
npm run dev
```

### Server Only

```bash
npm run dev:server
```

### Verify Specific Package Build

```bash
npm run build --workspace @monitor/server
npm run build --workspace @monitor/web
```

## Checkpoints When Modifying Code

- If changing core contract, verify web/types imports and server schema together
- If changing runtime adapter, update guide documentation and capability registry together
- If changing workflow library, verify evaluation route, repository, and web panel together

## Related Documentation

- [Server-Side Tests](./server-side-tests.md)
- [Web & Core Tests](./web-and-core-tests.md)
- [Quality And Testing](./quality-and-testing.md)
