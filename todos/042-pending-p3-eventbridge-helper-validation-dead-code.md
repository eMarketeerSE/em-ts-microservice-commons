---
name: createScheduledRule and createEventPatternRule contain validation dead code
description: Runtime checks in helper functions are unreachable — TypeScript types already enforce the constraints via Omit<>
type: finding
status: pending
priority: p3
issue_id: "042"
tags: [code-review, quality, eventbridge]
dependencies: []
---

## Problem Statement

`createScheduledRule` and `createEventPatternRule` in `src/cdk/constructs/eventbridge.ts` each perform a runtime check (e.g. `if (!config.schedule) throw ...`) after constraining the config type via `Omit<EventBridgeRuleConfig, 'eventPattern'>`. The TypeScript type system already makes the check impossible to trigger — a caller cannot pass `undefined` for `schedule` because it is required by the constrained type. The runtime checks are dead code that add noise and mislead readers into thinking there is a runtime risk that does not exist.

## Findings

- `src/cdk/constructs/eventbridge.ts:126-128` — `if (!config.schedule) throw` — unreachable
- `src/cdk/constructs/eventbridge.ts:140-142` — `if (!config.eventPattern) throw` — unreachable
- The `Omit<>` type constraint already prevents `undefined` for these fields at compile time

## Proposed Solutions

### Option A: Remove the runtime checks (Recommended)
The helper functions become simple wrappers with no guard body — their value is the type-narrowed signature.

### Option B: Replace with compile-time assertion
Use `config satisfies ...` or a TypeScript assertion if a compile-time proof is desired.

## Acceptance Criteria
- [ ] Dead `if (!config.schedule)` and `if (!config.eventPattern)` checks removed
- [ ] No runtime behaviour change — callers get the same error from the type system
