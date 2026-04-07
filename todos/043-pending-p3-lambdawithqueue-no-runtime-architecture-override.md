---
name: LambdaWithQueue hardcodes Runtime.NODEJS_22_X and Architecture.ARM_64 with no override
description: Unlike EmLambdaFunction, LambdaWithQueue cannot be configured for a different runtime or architecture — blocks future use cases
type: finding
status: pending
priority: p3
issue_id: "043"
tags: [code-review, architecture, lambda]
dependencies: []
---

## Problem Statement

`LambdaWithQueue` in `src/cdk/constructs/lambda-with-queue.ts` hardcodes `Runtime.NODEJS_22_X` and `Architecture.ARM_64`. `EmLambdaFunction` accepts both as optional config fields with the same values as defaults. This inconsistency means a service that needs a different runtime (e.g. a non-Node handler) or architecture (e.g. x86_64 for a specific native dependency) cannot use `LambdaWithQueue`.

## Findings

- `src/cdk/constructs/lambda-with-queue.ts:106-109` — runtime and architecture hardcoded
- `src/cdk/constructs/lambda.ts:45,55` — both fields configurable via `LambdaConfig`
- `LambdaWithQueueProps` has no `runtime` or `architecture` fields

## Proposed Solutions

### Option A: Add optional overrides to LambdaWithQueueProps (Recommended)
```ts
runtime?: Runtime  // default: Runtime.NODEJS_22_X
architecture?: Architecture  // default: Architecture.ARM_64
```
Apply in constructor: `runtime: props.runtime ?? Runtime.NODEJS_22_X`

## Acceptance Criteria
- [ ] `LambdaWithQueueProps` accepts optional `runtime` and `architecture`
- [ ] Defaults remain `NODEJS_22_X` and `ARM_64`
- [ ] `ServiceLambdaWithQueue` inherits the override capability
