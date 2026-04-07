---
name: importExistingLogGroup toggle-after-deploy risk not documented in JSDoc
description: Toggling importExistingLogGroup from false to true on an already-deployed CDK-managed LogGroup can cause deletion — not warned
type: finding
status: pending
priority: p2
issue_id: "039"
tags: [code-review, quality, cdk, migration]
dependencies: []
---

## Problem Statement

`importExistingLogGroup` in `LambdaConfig` switches between `new LogGroup(...)` (CFN-managed) and `LogGroup.fromLogGroupName(...)` (CFN-unmanaged). If a consumer initially deploys with the default (`false`), then re-deploys with `true`, CloudFormation removes the managed `LogGroup` resource. Without a prior `RemovalPolicy.RETAIN` deployed, this deletes the log group and all its data. The current JSDoc comment does not warn of this.

## Findings

- `src/cdk/types/common.ts` — JSDoc on `importExistingLogGroup` describes intended use but omits the toggle risk
- `src/cdk/constructs/lambda.ts:37-43` — no synth-time guard against toggling
- The feature is intended for SLS→CDK migration (log group pre-exists, never CDK-managed)

## Proposed Solutions

### Option A: Expand JSDoc with explicit warning (Recommended)
```ts
/**
 * When true, imports the log group by name instead of creating a managed resource.
 * Use when migrating existing functions where the log group was auto-created by Lambda.
 *
 * WARNING: Do NOT toggle this to true on a stack that previously deployed with false
 * (CDK-managed log group) without first setting RemovalPolicy.RETAIN on the log group.
 * Toggling without RETAIN will cause CloudFormation to delete the log group and its data.
 */
```

### Option B: Add synth-time assertion
Detect if a managed log group resource already exists in the stack and throw if `importExistingLogGroup` is set.

## Acceptance Criteria
- [ ] JSDoc clearly warns about the toggle-after-deploy risk
- [ ] Warning references RemovalPolicy.RETAIN as the prerequisite
