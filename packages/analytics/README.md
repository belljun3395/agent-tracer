# Agent Tracer Analytics

Evidence.dev BI project for local Agent Tracer analytics.

## Prerequisites

Run the monitor server once so DuckDB ETL creates:

```text
~/.agent-tracer/analytics.duckdb
```

## Commands

```bash
npm run sources --workspace @monitor/analytics
npm run dev --workspace @monitor/analytics
npm run build --workspace @monitor/analytics
```

Dev server URL:

```text
http://127.0.0.1:5175
```

