# AGENTS.md

## Purpose

This repository is developed using an autonomous agent workflow.

Your job is not only to write code.
Your job is to complete the current task and prove that the result satisfies
the repository requirements.

## Required reading

Before making changes, read:

1. `docs/product.md`
2. `docs/architecture.md`
3. `docs/security.md`
4. `docs/testing.md`
5. `tasks/current.md`
6. `docs/progress.md`
7. `tasks/backlog.md`

Read `docs/decisions.md` when making or changing architectural decisions.

## Core rules

- Use `pnpm` exclusively.
- Use TypeScript.
- Do not weaken type safety to silence errors.
- Do not disable lint rules without a documented reason.
- Do not remove tests because they fail.
- Do not expose Node.js APIs directly to the renderer.
- Do not store IMAP passwords unless explicitly required by the product specification.
- Do not introduce dependencies without a concrete need.
- Prefer existing platform capabilities over additional libraries.
- Inspect existing code before modifying it.
- Keep changes scoped to the current task.

## Task execution

For every task:

1. Read the current task and its acceptance criteria.
2. Inspect the relevant implementation.
3. Plan the smallest coherent change.
4. Implement it.
5. Run all required verification.
6. Fix failures.
7. Repeat verification until clean.
8. Update documentation if behavior or architecture changed.
9. Mark the task complete only when every acceptance criterion is satisfied.

## Completing a task

A task is finished only when the record-keeping below is done:

1. Mark the task in `tasks/current.md` as `Complete`.
2. Copy the completed task to `tasks/done/TASK-XXX.md`.
3. Add a concise entry to `docs/progress.md`.
4. Update `tasks/backlog.md`: remove the task if it was listed, and add any
   follow-up work discovered during the task.
5. Do not automatically start the next backlog task.

Exactly one active task exists at a time: `tasks/current.md`. The backlog
contains only future work.

## Verification

A task is not complete because the code looks correct.

It is complete only when the required repository checks pass.

The canonical verification command is:

`pnpm verify`

If `pnpm verify` does not exist yet and the current task requires creating it,
create it before considering the task complete.

## Architecture changes

Do not silently introduce architectural patterns.

If a task requires a meaningful architectural decision:

1. document it in `docs/decisions.md`;
2. explain the alternatives considered;
3. state why the chosen approach fits this project.

## Failure handling

If verification fails:

- investigate the cause;
- fix the implementation;
- run verification again.

Do not bypass checks simply to reach a green build.

## Scope control

Do not implement backlog items that are not part of `tasks/current.md`.

Small supporting changes are allowed when necessary to complete the current task.

Avoid speculative abstractions and future-proofing.
