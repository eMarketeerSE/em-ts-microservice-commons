---
name: Child construct IDs use ${id} prefix anti-pattern in LambdaWithQueue and EmLambdaFunction
description: Prefixing child IDs with the parent's id produces doubled path segments and fragile logical IDs — CDK convention is stable short IDs
type: finding
status: pending
priority: p2
issue_id: "040"
tags: [code-review, architecture, cdk]
dependencies: []
---

## Problem Statement

Both `LambdaWithQueue` and `EmLambdaFunction` prefix child resource construct IDs with the parent's `id` parameter (e.g. `new Queue(this, \`${id}DLQ\`, ...)`). CDK best practice is to use stable, short IDs for children (`'DLQ'`, `'Queue'`, `'Function'`) because the parent's id already forms part of the construct path and therefore the CloudFormation logical ID. The `${id}` prefix causes logical IDs like `MyQueueMyQueueDLQ` — the name appears twice — and makes templates harder to read and cross-reference.

## Findings

- `src/cdk/constructs/lambda-with-queue.ts:65` — `new Queue(this, \`${id}DLQ\`, ...)`
- `src/cdk/constructs/lambda-with-queue.ts:71` — `new Queue(this, \`${id}Queue\`, ...)`
- `src/cdk/constructs/lambda-with-queue.ts:82` — `new Role(this, \`${id}Role\`, ...)`
- `src/cdk/constructs/lambda-with-queue.ts:98` — `new LogGroup(this, \`${id}LogGroup\`, ...)`
- `src/cdk/constructs/lambda.ts:37` — `new LogGroup(this, \`${id}LogGroup\`, ...)`
- This is a breaking change once any stack is deployed — changing child IDs changes CF logical IDs

## Proposed Solutions

### Option A: Fix now (no stacks deployed yet using LambdaWithQueue)
Replace `${id}DLQ` → `'DLQ'`, `${id}Queue` → `'Queue'`, etc. Safe since no live CF stacks use these constructs.

### Option B: Defer
Document as known tech debt. Fix before first service adoption of LambdaWithQueue.

## Acceptance Criteria
- [ ] Child construct IDs are stable short strings (`'DLQ'`, `'Queue'`, `'Function'`, `'LogGroup'`, `'Role'`)
- [ ] CloudFormation logical IDs no longer duplicate the parent construct name
- [ ] Confirmed no deployed stacks use these constructs before applying
