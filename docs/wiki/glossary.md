# Glossary

## Task

A high-level work item on a per-user-goal basis. Status is usually one of `running`, `waiting`, `completed`, or `errored`.

## Session

An individual agent execution period within a task. Multiple sessions can be chained in the same task.

## Timeline Event

A unit of individual recording such as tool use, user message, verification, thought, or assistant response.

## Lane

A vertical classification axis for easy reading of events. There are 8 canonical lanes per core.

## Runtime Adapter

A runtime integration path that collects events and sends them to the Agent Tracer server, like Claude plugin.

## Runtime Session Binding

A storage layer that binds stable session/thread IDs from external runtimes to monitor tasks/sessions.

## Workflow Library

A set of features that evaluate past work (`good`/`skip`) and enable re-search later.

## Workflow Summary

An abbreviated record displayed in the workflow library list. Contains evaluation information and task metadata together.

## Workflow Context

A markdown summary included in similar search results. Compresses original request, key steps, modified files, TODOs, and verification information.

## Handoff

A summary expression that allows current task state to be passed to another agent or next session. In UI, represented by `TaskHandoffPanel` and handoff markdown/XML generators.

## Compact Event

A signal that the agent summarized or reduced context. Used like a time marker in planning/insight context.

## Gap Report

An operational policy that continues work even if monitor server is down and summarizes unrecorded information at the end.
