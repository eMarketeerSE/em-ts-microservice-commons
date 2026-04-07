---
name: em-commons.ts exits 0 on unhandled error before result is assigned
description: process.exit(result?.status!) exits with code 0 when result is undefined — pipeline sees success on failure
type: finding
status: pending
priority: p2
issue_id: "037"
tags: [code-review, quality, cli]
dependencies: []
---

## Problem Statement

`src/em-commons.ts` ends with `process.exit(result?.status!)`. If an exception is thrown before `result` is assigned and caught via `unhandledRejection`, the exit call receives `undefined`, which coerces to `process.exit(0)` — a success signal. CI pipelines checking exit codes will treat this as a passing build.

## Findings

- `src/em-commons.ts` — `process.exit(result?.status!)` with no null fallback
- `result?.status!` is `undefined` → `process.exit(undefined)` → exits 0
- Non-null assertion (`!`) suppresses TypeScript warning but does not guard at runtime

## Proposed Solutions

### Option A: Add null fallback (Recommended)
```ts
process.exit(result?.status ?? 1)
```

### Option B: Default result to error state
Initialize `result` to `{ status: 1 }` before the try block.

## Acceptance Criteria
- [ ] Any error path before `result` is assigned exits with code 1
- [ ] Normal success still exits 0
- [ ] `! ` non-null assertion removed
