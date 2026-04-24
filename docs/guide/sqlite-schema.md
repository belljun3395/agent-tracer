# SQLite Schema

The Agent Tracer server uses SQLite as its OLTP store. New databases are
created directly with the normalized schema described here. There is no
legacy migration path before the first deployment; `runMigrations` is a no-op.

The schema has five major areas:

- Append-only domain events and content blobs.
- Current task/session projections.
- Normalized runtime timeline events.
- Workflow evaluations and playbooks.
- Shared search documents and embeddings.

`PRAGMA foreign_keys = ON` is enabled before schema creation. Most child tables
use `on delete cascade`; optional links that should survive parent deletion use
`on delete set null`.

## Table Overview

| Layer | Table | Role |
|---|---|---|
| Event log | `events` | Append-only domain event log |
| Blob store | `content_blobs` | Stores large payloads and body blobs |
| Current state | `tasks_current` | Current task state |
| Current state | `task_relations` | Parent/background/session task links |
| Current state | `sessions_current` | Current session state |
| Timeline | `timeline_events_view` | Runtime timeline event core columns |
| Timeline | `event_files` | Files and paths mentioned by events |
| Timeline | `event_relations` | Explicit event graph edges |
| Timeline | `event_async_refs` | Runtime async task references |
| Timeline | `event_tags` | Runtime/classification tags |
| Timeline | `rule_enforcements` | Rule decision facts |
| Timeline | `verification_outcomes` | Verification outcome facts |
| Timeline | `todos_current` | Current TODO state projected from events |
| Timeline | `questions_current` | Current question state projected from events |
| Timeline | `event_token_usage` | Token, model, cost, and stop metadata |
| Current state | `runtime_bindings_current` | Runtime session bindings |
| Current state | `bookmarks_current` | Current bookmark state |
| Workflow | `evaluations_core` | Evaluation identity, scope, rating, version |
| Workflow | `evaluation_contents` | Evaluation notes and reusable workflow content |
| Workflow | `evaluation_reuse_stats` | Evaluation reuse counters |
| Workflow | `evaluation_promotions` | Evaluation-to-playbook promotion history |
| Workflow | `playbooks_core` | Playbook identity and core text |
| Workflow | `playbook_steps` | Prereqs, steps, watchouts, anti-patterns, failure modes |
| Workflow | `playbook_variants` | Playbook variants |
| Workflow | `playbook_tags` | Playbook tags |
| Workflow | `playbook_relations` | Related playbooks |
| Workflow | `playbook_source_snapshots` | Source evaluation snapshots |
| Current state | `briefings_current` | Generated briefings |
| Current state | `turn_partitions_current` | Persisted task turn partitions |
| Current state | `rule_commands_current` | Current rule command state |
| Search index | `search_documents` | Search and embedding index for tasks, events, bookmarks, evaluations, and playbooks |

## Relationship Diagram

```mermaid
erDiagram
  EVENTS {
    text event_id PK
    integer event_time
    text event_type
    text aggregate_id
    text session_id
  }

  CONTENT_BLOBS {
    text sha256 PK
    integer byte_size
    text mime
  }

  TASKS_CURRENT {
    text id PK
    text title
    text slug
    text status
    text task_kind
  }

  TASK_RELATIONS {
    text task_id FK
    text related_task_id FK
    text relation_kind
    text session_id
  }

  SESSIONS_CURRENT {
    text id PK
    text task_id
    text status
  }

  TIMELINE_EVENTS_VIEW {
    text id PK
    text task_id FK
    text session_id FK
    text kind
    text lane
    text extras_json
  }

  EVENT_FILES {
    text event_id PK,FK
    text file_path PK
    text source
  }

  EVENT_RELATIONS {
    text event_id PK,FK
    text source_event_id PK
    text target_event_id PK
    text edge_kind PK
    text relation_type PK
  }

  EVENT_ASYNC_REFS {
    text event_id PK,FK
    text async_task_id
  }

  EVENT_TAGS {
    text event_id PK,FK
    text tag PK
  }

  RULE_ENFORCEMENTS {
    text event_id PK,FK
    text rule_id
    text outcome
  }

  VERIFICATION_OUTCOMES {
    text event_id PK,FK
    text rule_id
    text status
  }

  TODOS_CURRENT {
    text id PK
    text task_id FK
    text last_event_id FK
    text state
  }

  QUESTIONS_CURRENT {
    text id PK
    text task_id FK
    text last_event_id FK
    text phase
  }

  EVENT_TOKEN_USAGE {
    text event_id PK,FK
    text task_id FK
    text session_id FK
  }

  RUNTIME_BINDINGS_CURRENT {
    text runtime_source PK
    text runtime_session_id PK
    text task_id FK
    text monitor_session_id FK
  }

  BOOKMARKS_CURRENT {
    text id PK
    text task_id FK
    text event_id FK
  }

  EVALUATIONS_CORE {
    text task_id PK,FK
    text scope_key PK
    text rating
  }

  EVALUATION_CONTENTS {
    text task_id PK,FK
    text scope_key PK,FK
  }

  EVALUATION_REUSE_STATS {
    text task_id PK,FK
    text scope_key PK,FK
  }

  EVALUATION_PROMOTIONS {
    text task_id PK,FK
    text scope_key PK,FK
    text playbook_id PK
  }

  PLAYBOOKS_CORE {
    text id PK
    text slug
    text status
  }

  PLAYBOOK_STEPS {
    text playbook_id PK,FK
    text kind PK
    integer position PK
  }

  PLAYBOOK_VARIANTS {
    text playbook_id PK,FK
    integer position PK
  }

  PLAYBOOK_TAGS {
    text playbook_id PK,FK
    text tag PK
  }

  PLAYBOOK_RELATIONS {
    text playbook_id PK,FK
    text related_playbook_id PK,FK
  }

  PLAYBOOK_SOURCE_SNAPSHOTS {
    text playbook_id PK,FK
    text task_id PK,FK
    text scope_key PK,FK
  }

  BRIEFINGS_CURRENT {
    text id PK
    text task_id FK
  }

  TURN_PARTITIONS_CURRENT {
    text task_id PK,FK
  }

  RULE_COMMANDS_CURRENT {
    text id PK
    text task_id FK
  }

  SEARCH_DOCUMENTS {
    text scope PK
    text entity_id PK
    text task_id
  }

  TASKS_CURRENT ||--o{ TASK_RELATIONS : owns
  TASKS_CURRENT ||--o{ SESSIONS_CURRENT : has
  TASKS_CURRENT ||--o{ TIMELINE_EVENTS_VIEW : has
  SESSIONS_CURRENT ||--o{ TIMELINE_EVENTS_VIEW : records
  TIMELINE_EVENTS_VIEW ||--o{ EVENT_FILES : mentions
  TIMELINE_EVENTS_VIEW ||--o{ EVENT_RELATIONS : owns_edge
  TIMELINE_EVENTS_VIEW ||--o| EVENT_ASYNC_REFS : async_ref
  TIMELINE_EVENTS_VIEW ||--o{ EVENT_TAGS : tagged
  TIMELINE_EVENTS_VIEW ||--o| RULE_ENFORCEMENTS : rule
  TIMELINE_EVENTS_VIEW ||--o| VERIFICATION_OUTCOMES : verification
  TIMELINE_EVENTS_VIEW ||--o| EVENT_TOKEN_USAGE : token_usage
  TIMELINE_EVENTS_VIEW ||--o{ BOOKMARKS_CURRENT : bookmarked
  TASKS_CURRENT ||--o{ TODOS_CURRENT : has
  TASKS_CURRENT ||--o{ QUESTIONS_CURRENT : has
  TASKS_CURRENT ||--o{ RUNTIME_BINDINGS_CURRENT : bound
  SESSIONS_CURRENT ||--o{ RUNTIME_BINDINGS_CURRENT : monitor_session
  TASKS_CURRENT ||--o{ BOOKMARKS_CURRENT : has
  TASKS_CURRENT ||--o{ EVALUATIONS_CORE : evaluated
  EVALUATIONS_CORE ||--|| EVALUATION_CONTENTS : content
  EVALUATIONS_CORE ||--|| EVALUATION_REUSE_STATS : stats
  EVALUATIONS_CORE ||--o{ EVALUATION_PROMOTIONS : promotions
  PLAYBOOKS_CORE ||--o{ PLAYBOOK_STEPS : steps
  PLAYBOOKS_CORE ||--o{ PLAYBOOK_VARIANTS : variants
  PLAYBOOKS_CORE ||--o{ PLAYBOOK_TAGS : tags
  PLAYBOOKS_CORE ||--o{ PLAYBOOK_RELATIONS : related
  PLAYBOOKS_CORE ||--o{ PLAYBOOK_SOURCE_SNAPSHOTS : source
  EVALUATIONS_CORE ||--o{ PLAYBOOK_SOURCE_SNAPSHOTS : source
  TASKS_CURRENT ||--o{ BRIEFINGS_CURRENT : briefings
  TASKS_CURRENT ||--o| TURN_PARTITIONS_CURRENT : turn_partitions
  TASKS_CURRENT |o--o{ RULE_COMMANDS_CURRENT : optional_task_scope
  TASKS_CURRENT ||--o{ SEARCH_DOCUMENTS : task_scope
```

## Compatibility Notes

`timeline_events_view` is still named as a view-style table for API and query
compatibility, but it now stores only event core columns plus semantic columns
and `extras_json`. The old `metadata_json` and `classification_json` columns are
not present for timeline events.

The repository read path reconstructs the public `TimelineEvent.metadata` shape
from normalized tables:

- semantic columns become `metadata.subtypeKey`, `metadata.toolFamily`, and
  related fields;
- `event_files` becomes `metadata.filePaths`, and the first/relpath value is
  exposed as `metadata.filePath`/`metadata.relPath`;
- `event_relations` becomes `metadata.parentEventId`, `metadata.sourceEventId`,
  `metadata.relatedEventIds`, and `metadata.relationType`;
- `event_tags` becomes `metadata.tags` and `classification.tags`;
- async, rule, verification, TODO, question, and token rows are merged back into
  metadata for existing API consumers.

`bookmarks_current.metadata_json` remains a bookmark-local JSON field and is not
part of the timeline metadata normalization.

## Event Log

```sql
create table if not exists events (
  event_id text primary key,
  event_time integer not null,
  event_type text not null,
  schema_ver integer not null,
  aggregate_id text not null,
  session_id text,
  actor text not null,
  correlation_id text,
  causation_id text,
  payload_json text not null,
  recorded_at integer not null
);
```

Indexes:

```sql
create index if not exists idx_events_aggregate_time
  on events(aggregate_id, event_time);

create index if not exists idx_events_type_time
  on events(event_type, event_time);

create index if not exists idx_events_session_time
  on events(session_id, event_time);

create index if not exists idx_events_correlation
  on events(correlation_id);
```

## Content Blobs

```sql
create table if not exists content_blobs (
  sha256 text primary key,
  byte_size integer not null,
  mime text,
  created_at integer not null,
  body blob not null
);
```

## Task And Session Projections

`tasks_current` stores only task core state. Task hierarchy and background links
are stored in `task_relations`.

```sql
create table if not exists tasks_current (
  id text primary key,
  title text not null,
  slug text not null,
  workspace_path text,
  status text not null,
  task_kind text not null default 'primary',
  created_at text not null,
  updated_at text not null,
  last_session_started_at text,
  cli_source text
);

create table if not exists task_relations (
  task_id text not null references tasks_current(id) on delete cascade,
  related_task_id text references tasks_current(id) on delete cascade,
  relation_kind text not null check(relation_kind in ('parent','background','spawned_by_session')),
  session_id text,
  check (
    (relation_kind in ('parent','background') and related_task_id is not null and session_id is null)
    or
    (relation_kind = 'spawned_by_session' and related_task_id is null and session_id is not null)
  )
);

create table if not exists sessions_current (
  id text primary key,
  task_id text not null,
  status text not null,
  summary text,
  started_at text not null,
  ended_at text
);
```

Indexes:

```sql
create index if not exists idx_tasks_current_updated
  on tasks_current(updated_at desc);

create unique index if not exists idx_task_relations_task_related
  on task_relations(task_id, relation_kind, related_task_id)
  where related_task_id is not null;

create unique index if not exists idx_task_relations_task_session
  on task_relations(task_id, relation_kind, session_id)
  where session_id is not null;

create index if not exists idx_task_relations_related
  on task_relations(related_task_id, relation_kind);

create index if not exists idx_sessions_current_task_started
  on sessions_current(task_id, started_at);

create index if not exists idx_sessions_current_task_status_started
  on sessions_current(task_id, status, started_at desc);
```

`task_relations.relation_kind` has these meanings:

| Kind | Columns | Meaning |
|---|---|---|
| `parent` | `related_task_id` | This task is a child of another task |
| `background` | `related_task_id` | This task belongs to a background root task |
| `spawned_by_session` | `session_id` | This task was spawned from a monitor session |

## Timeline Events

`timeline_events_view` stores event identity, display fields, and promoted
semantic fields. Residual, non-promoted metadata is stored in `extras_json`.

```sql
create table if not exists timeline_events_view (
  id text primary key,
  task_id text not null references tasks_current(id) on delete cascade,
  session_id text references sessions_current(id) on delete set null,
  kind text not null,
  lane text not null,
  title text not null,
  body text,
  subtype_key text,
  subtype_label text,
  subtype_group text,
  tool_family text,
  operation text,
  source_tool text,
  tool_name text,
  entity_type text,
  entity_name text,
  display_title text,
  evidence_level text,
  extras_json text not null default '{}',
  created_at text not null
);
```

Indexes:

```sql
create index if not exists idx_timeline_events_view_task_created
  on timeline_events_view(task_id, created_at);

create index if not exists idx_timeline_events_subtype_group
  on timeline_events_view(subtype_group, created_at);

create index if not exists idx_timeline_events_tool_family
  on timeline_events_view(tool_family);

create index if not exists idx_timeline_events_lane_created
  on timeline_events_view(lane, created_at);
```

## Timeline Detail Tables

The following tables replace the previous timeline metadata god-blob.

```sql
create table if not exists event_files (
  event_id text not null references timeline_events_view(id) on delete cascade,
  file_path text not null,
  source text not null default 'metadata' check(source in ('metadata','command_analysis','runtime_relpath','multiple')),
  write_count integer not null default 0,
  primary key (event_id, file_path)
);

create table if not exists event_relations (
  event_id text not null references timeline_events_view(id) on delete cascade,
  source_event_id text not null,
  target_event_id text not null,
  edge_kind text not null check(edge_kind in ('parent','source','related')),
  relation_type text not null default 'relates_to'
    check(relation_type in ('implements','revises','verifies','answers','delegates','returns','completes','blocks','caused_by','relates_to')),
  relation_label text,
  relation_explanation text,
  primary key (event_id, source_event_id, target_event_id, edge_kind, relation_type)
);

create table if not exists event_async_refs (
  event_id text primary key references timeline_events_view(id) on delete cascade,
  async_task_id text not null,
  async_status text,
  async_agent text,
  async_category text,
  duration_ms integer
);

create table if not exists event_tags (
  event_id text not null references timeline_events_view(id) on delete cascade,
  tag text not null,
  source text not null default 'metadata' check(source in ('metadata','classification','multiple')),
  primary key (event_id, tag)
);
```

`event_relations.edge_kind` records structural origin (`parent`, `source`, or
`related`). `event_relations.relation_type` preserves the semantic relation
(`implements`, `verifies`, `caused_by`, and so on).

```sql
create table if not exists rule_enforcements (
  event_id text primary key references timeline_events_view(id) on delete cascade,
  rule_id text,
  policy text,
  outcome text,
  status text,
  decided_at text not null
);

create table if not exists verification_outcomes (
  event_id text primary key references timeline_events_view(id) on delete cascade,
  rule_id text,
  status text,
  checked_at text not null
);

create table if not exists todos_current (
  id text primary key,
  task_id text not null references tasks_current(id) on delete cascade,
  title text not null,
  state text not null check(state in ('added','in_progress','completed','cancelled')),
  priority text,
  auto_reconciled integer not null default 0,
  last_event_id text references timeline_events_view(id) on delete set null,
  created_at text not null,
  updated_at text not null
);

create table if not exists questions_current (
  id text primary key,
  task_id text not null references tasks_current(id) on delete cascade,
  title text not null,
  phase text not null check(phase in ('asked','answered','concluded')),
  sequence integer,
  model_name text,
  model_provider text,
  last_event_id text references timeline_events_view(id) on delete set null,
  created_at text not null,
  updated_at text not null
);

create table if not exists event_token_usage (
  event_id text primary key references timeline_events_view(id) on delete cascade,
  session_id text references sessions_current(id) on delete set null,
  task_id text not null references tasks_current(id) on delete cascade,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_create_tokens integer not null default 0,
  cost_usd real,
  duration_ms integer,
  model text,
  prompt_id text,
  stop_reason text,
  occurred_at text not null
);
```

Detail indexes:

```sql
create index if not exists idx_event_files_path on event_files(file_path);
create index if not exists idx_event_files_event on event_files(event_id);
create index if not exists idx_event_relations_source on event_relations(source_event_id);
create index if not exists idx_event_relations_target on event_relations(target_event_id);
create index if not exists idx_event_async_refs_task on event_async_refs(async_task_id);
create index if not exists idx_event_tags_tag on event_tags(tag);
create index if not exists idx_rule_enforcements_rule on rule_enforcements(rule_id);
create index if not exists idx_rule_enforcements_outcome on rule_enforcements(outcome);
create index if not exists idx_rule_enforcements_status on rule_enforcements(status);
create index if not exists idx_verification_outcomes_status on verification_outcomes(status);
create index if not exists idx_todos_task_state on todos_current(task_id, state);
create index if not exists idx_questions_task_phase on questions_current(task_id, phase);
create index if not exists idx_event_token_usage_session on event_token_usage(session_id, occurred_at);
create index if not exists idx_event_token_usage_model on event_token_usage(model);
create index if not exists idx_event_token_usage_task on event_token_usage(task_id, occurred_at);
```

## Runtime Bindings And Bookmarks

```sql
create table if not exists runtime_bindings_current (
  runtime_source text not null,
  runtime_session_id text not null,
  task_id text not null references tasks_current(id) on delete cascade,
  monitor_session_id text references sessions_current(id) on delete set null,
  created_at text not null,
  updated_at text not null,
  primary key (runtime_source, runtime_session_id)
);

create table if not exists bookmarks_current (
  id text primary key,
  task_id text not null references tasks_current(id) on delete cascade,
  event_id text references timeline_events_view(id) on delete cascade,
  kind text not null,
  title text not null,
  note text,
  metadata_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);
```

`bookmarks_current.kind` is `task` or `event`. `bookmarks_current.metadata_json`
is intentionally bookmark-local metadata.

## Search Documents

`search_documents` is the shared lexical and embedding index. Embeddings for
evaluations and playbooks live here, not in their core tables.

```sql
create table if not exists search_documents (
  scope text not null check(scope in ('task', 'event', 'bookmark', 'evaluation', 'playbook')),
  entity_id text not null,
  task_id text,
  search_text text not null,
  embedding text,
  embedding_model text,
  updated_at text not null,
  primary key (scope, entity_id)
);
```

| Scope | Entity id |
|---|---|
| `task` | Task id |
| `event` | Timeline event id |
| `bookmark` | Bookmark id |
| `evaluation` | `${task_id}#${scope_key}` |
| `playbook` | Playbook id |

Indexes:

```sql
create index if not exists idx_search_documents_scope_task_updated
  on search_documents(scope, task_id, updated_at desc);
```

## Workflow Evaluations

Evaluations are split into identity/rating, content, reuse statistics, and
promotion history.

```sql
create table if not exists evaluations_core (
  task_id text not null references tasks_current(id) on delete cascade,
  scope_key text not null default 'task',
  scope_kind text not null check(scope_kind in ('task','turn')),
  scope_label text not null,
  turn_index integer,
  rating text not null check(rating in ('good','skip')),
  version integer not null default 1,
  evaluated_at text not null,
  primary key (task_id, scope_key)
);

create table if not exists evaluation_contents (
  task_id text not null,
  scope_key text not null,
  use_case text,
  workflow_tags_json text,
  outcome_note text,
  approach_note text,
  reuse_when text,
  watchouts text,
  workflow_snapshot_json text,
  workflow_context text,
  primary key (task_id, scope_key),
  foreign key (task_id, scope_key) references evaluations_core(task_id, scope_key) on delete cascade
);

create table if not exists evaluation_reuse_stats (
  task_id text not null,
  scope_key text not null,
  reuse_count integer not null default 0,
  last_reused_at text,
  briefing_copy_count integer not null default 0,
  primary key (task_id, scope_key),
  foreign key (task_id, scope_key) references evaluations_core(task_id, scope_key) on delete cascade
);

create table if not exists evaluation_promotions (
  task_id text not null,
  scope_key text not null,
  playbook_id text not null,
  promoted_at text not null,
  primary key (task_id, scope_key, playbook_id),
  foreign key (task_id, scope_key) references evaluations_core(task_id, scope_key) on delete cascade
);
```

Indexes:

```sql
create index if not exists idx_evaluations_core_rating on evaluations_core(rating);
create index if not exists idx_evaluation_promotions_playbook on evaluation_promotions(playbook_id);
```

## Playbooks

Playbooks are split into core fields and typed child rows. JSON arrays are not
stored in `playbooks_core`; the repository reconstructs the public
`PlaybookRecord` shape from child tables.

```sql
create table if not exists playbooks_core (
  id text primary key,
  title text not null,
  slug text unique not null,
  status text not null default 'draft',
  when_to_use text,
  approach text,
  use_count integer not null default 0,
  last_used_at text,
  created_at text not null,
  updated_at text not null
);

create table if not exists playbook_steps (
  playbook_id text not null references playbooks_core(id) on delete cascade,
  kind text not null check(kind in ('prereq','step','watchout','anti_pattern','failure_mode')),
  position integer not null,
  content text not null,
  primary key (playbook_id, kind, position)
);

create table if not exists playbook_variants (
  playbook_id text not null references playbooks_core(id) on delete cascade,
  position integer not null,
  label text not null,
  description text not null,
  difference_from_base text not null,
  primary key (playbook_id, position)
);

create table if not exists playbook_tags (
  playbook_id text not null references playbooks_core(id) on delete cascade,
  tag text not null,
  primary key (playbook_id, tag)
);

create table if not exists playbook_relations (
  playbook_id text not null references playbooks_core(id) on delete cascade,
  related_playbook_id text not null references playbooks_core(id) on delete cascade,
  kind text,
  position integer,
  primary key (playbook_id, related_playbook_id)
);

create table if not exists playbook_source_snapshots (
  playbook_id text not null references playbooks_core(id) on delete cascade,
  task_id text not null,
  scope_key text not null,
  primary key (playbook_id, task_id, scope_key),
  foreign key (task_id, scope_key) references evaluations_core(task_id, scope_key) on delete cascade
);
```

Indexes:

```sql
create index if not exists idx_playbooks_core_status on playbooks_core(status);
create index if not exists idx_playbook_tags_tag on playbook_tags(tag);
```

## Briefings, Turn Partitions, And Rules

```sql
create table if not exists briefings_current (
  id text primary key,
  task_id text not null references tasks_current(id) on delete cascade,
  generated_at text not null,
  purpose text not null,
  format text not null,
  memo text,
  content text not null
);

create table if not exists turn_partitions_current (
  task_id text primary key references tasks_current(id) on delete cascade,
  groups_json text not null,
  version integer not null default 1,
  updated_at text not null
);

create table if not exists rule_commands_current (
  id text primary key,
  pattern text not null,
  label text not null,
  task_id text references tasks_current(id) on delete cascade,
  created_at text not null
);
```

`rule_commands_current.task_id` is nullable. `null` means the command is global;
a non-null value scopes the command to one task.

Indexes:

```sql
create index if not exists idx_briefings_current_task_generated
  on briefings_current(task_id, generated_at desc);

create index if not exists idx_rule_commands_current_task_id
  on rule_commands_current(task_id);
```

## Event Catalog

| Group | Event type |
|---|---|
| Task | `task.created` |
| Task | `task.renamed` |
| Task | `task.status_changed` |
| Task | `task.hierarchy_changed` |
| Session | `session.started` |
| Session | `session.ended` |
| Session | `session.bound` |
| Runtime | `tool.invoked` |
| Runtime | `tool.result` |
| Runtime | `prompt.submitted` |
| Runtime | `completion.received` |
| Runtime | `classification.assigned` |
| Curation | `bookmark.added` |
| Curation | `bookmark.removed` |
| Curation | `evaluation.recorded` |
| Curation | `evaluation.reused` |
| Curation | `turn.partition_updated` |
| Curation | `turn.partition_reset` |
| Workflow | `playbook.drafted` |
| Workflow | `playbook.published` |
| Workflow | `playbook.used` |
| Workflow | `briefing.generated` |
| System | `rule_command.registered` |
| System | `rule_command.matched` |

## Event Store API

| API | Return / effect |
|---|---|
| `append(event)` | Appends a domain event to `events` and updates projections |
| `readAggregate(aggregateId, from?)` | Returns aggregate events in chronological order |
| `readByType(type, range?)` | Returns events by type and time range |
| `putContentBlob(input)` | Stores a blob in `content_blobs` |
| `getContentBlob(sha256)` | Looks up a blob by hash |

## Replay CLI

```bash
tsx packages/server/src/main/replay-events.ts .monitor/monitor.sqlite <aggregate-id>
```

```bash
tsx packages/server/src/main/replay-events.ts .monitor/monitor.sqlite <aggregate-id> <from-event-id>
```
