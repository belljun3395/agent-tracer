# Testing & Development

This page is the practical starting point for day-to-day development. It
lists the commands you will actually run and points out the package
boundaries that matter while editing.

## Root commands

```bash
npm run build
npm run lint
npm run lint:deps
npm test
npm run dev
```

## Common per-package commands

- `npm run test --workspace @monitor/domain`
- `npm run test --workspace @monitor/classification`
- `npm run test --workspace @monitor/application`
- `npm run test --workspace @monitor/server`
- `npm run test --workspace @monitor/adapter-mcp`
- `npm run test --workspace @monitor/web-app`

Useful targeted builds:

```bash
npm run build --workspace @monitor/server
npm run build --workspace @monitor/web-app
```

## Common development loops

### Full local app

```bash
npm run dev
```

Runs the monitor server and the dashboard together.

### Server only

```bash
npm run dev:server
```

### Dashboard only

```bash
npm run dev:web
```

Assumes the server is already running.

### Docs only

```bash
npm run docs:dev
```

## Checkpoints when modifying code

- If you change domain or classification contracts, verify the server and
  web still agree on the shared shape
- If you change a runtime adapter, update the relevant guide/wiki page in
  the same change
- If you change a package boundary, run `npm run lint:deps`
- If you change workflow evaluation or search, verify both the backend
  and the knowledge/playbook UI

## Related documentation

- [Server-side tests](./server-side-tests.md)
- [Web & core tests](./web-and-core-tests.md)
- [Quality and Testing](./quality-and-testing.md)
