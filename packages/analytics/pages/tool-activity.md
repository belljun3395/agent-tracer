---
title: Tool Activity
---

Tracks **which files, commands, and URLs tool calls actually targeted**. Failed and interrupted calls are surfaced alongside successful ones so recurring error spots are easy to spot.

## Overview

```sql tool_activity_overview
select
  count(*) as tool_calls,
  sum(case when failed = true then 1 else 0 end) as failed_calls,
  sum(case when is_interrupt = true then 1 else 0 end) as interrupted_calls,
  round(sum(case when failed = true then 1 else 0 end)::double / nullif(count(*), 0), 4) as failure_rate,
  count(distinct task_id) as tasks_touched,
  count(distinct file_path) filter (where file_path is not null) as distinct_files_touched,
  count(distinct command_text) filter (where command_text is not null) as distinct_commands_run,
  count(distinct web_url) filter (where web_url is not null) as distinct_urls_fetched,
  count(distinct mcp_server) filter (where mcp_server is not null) as distinct_mcp_servers
from agent_tracer.fact_tool_calls
```

<Grid cols=3>
  <BigValue data={tool_activity_overview} value=tool_calls title="Tool Calls" />
  <BigValue data={tool_activity_overview} value=failed_calls title="Failed" />
  <BigValue data={tool_activity_overview} value=failure_rate title="Failure Rate" fmt=pct1 />
  <BigValue data={tool_activity_overview} value=distinct_files_touched title="Distinct Files" />
  <BigValue data={tool_activity_overview} value=distinct_commands_run title="Distinct Commands" />
  <BigValue data={tool_activity_overview} value=distinct_urls_fetched title="Distinct URLs" />
</Grid>

## Top Touched Files

File paths targeted by Read / Write / Edit / NotebookEdit calls, grouped. Repeated hits on the same file flag it as a task hotspot.

```sql top_files
select
  coalesce(rel_path, file_path) as path,
  count(*) as call_count,
  sum(case when tool_category = 'file_read' then 1 else 0 end) as read_count,
  sum(case when tool_category = 'file_edit' then 1 else 0 end) as edit_count,
  sum(case when tool_category = 'file_write' then 1 else 0 end) as write_count,
  sum(case when failed = true then 1 else 0 end) as failed_count,
  count(distinct task_id) as task_count
from agent_tracer.fact_tool_calls
where file_path is not null
group by coalesce(rel_path, file_path)
order by call_count desc, path
limit 50
```

<DataTable data={top_files} rows=20 />

## Top Shell Commands

Actual shell commands the `Bash` tool executed. Repeated `npm test` / `git status` runs are a signal of inefficient or flaky verification flows.

```sql top_commands
select
  coalesce(command_text, '(unknown)') as command,
  coalesce(command_description, '') as description,
  count(*) as call_count,
  sum(case when failed = true then 1 else 0 end) as failed_count,
  round(avg(duration_ms), 0) as avg_duration_ms,
  count(distinct task_id) as task_count
from agent_tracer.fact_tool_calls
where command_text is not null
group by command_text, command_description
order by call_count desc, command
limit 50
```

<DataTable data={top_commands} rows=20 />

## Web Fetch Targets

```sql top_web
select
  coalesce(web_url, '(unknown)') as url,
  tool_name,
  count(*) as call_count,
  sum(case when failed = true then 1 else 0 end) as failed_count,
  count(distinct task_id) as task_count
from agent_tracer.fact_tool_calls
where web_url is not null
group by web_url, tool_name
order by call_count desc
limit 50
```

<DataTable data={top_web} rows=20 />

## MCP Tool Usage

```sql mcp_usage
select
  coalesce(mcp_server, 'unknown') as mcp_server,
  coalesce(mcp_tool, 'unknown') as mcp_tool,
  count(*) as call_count,
  sum(case when failed = true then 1 else 0 end) as failed_count,
  count(distinct task_id) as task_count
from agent_tracer.fact_tool_calls
where mcp_server is not null or mcp_tool is not null
group by mcp_server, mcp_tool
order by call_count desc
```

<DataTable data={mcp_usage} rows=20 />

## Recent Failures

The 50 most recent failed or interrupted tool calls. Useful for seeing which error messages surfaced and which targets failed.

```sql recent_failures
select
  invoked_at_ms,
  task_id,
  tool_name,
  tool_category,
  coalesce(call_target, '') as target,
  coalesce(error_message, '') as error_message,
  is_interrupt,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_tool_calls
where failed = true or is_interrupt = true
order by invoked_at_ms desc
limit 50
```

<DataTable data={recent_failures} link=task_link rows=20 />

## Failure Rate by Tool

```sql failure_by_tool
select
  tool_name,
  coalesce(tool_category, 'other') as tool_category,
  count(*) as call_count,
  sum(case when failed = true then 1 else 0 end) as failed_count,
  round(sum(case when failed = true then 1 else 0 end)::double / nullif(count(*), 0), 4) as failure_rate
from agent_tracer.fact_tool_calls
group by tool_name, tool_category
having count(*) >= 5
order by failure_rate desc, call_count desc
limit 30
```

<BarChart
  data={failure_by_tool}
  x=tool_name
  y=failure_rate
  yFmt=pct1
  title="Failure rate by tool (>=5 calls)"
/>

<DataTable data={failure_by_tool} rows=20 />
