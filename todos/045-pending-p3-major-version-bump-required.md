---
name: Breaking changes in PR require semver major version bump
description: Removed public methods, removed props, and changed prop defaults constitute a semver-major change
type: finding
status: pending
priority: p3
issue_id: "045"
tags: [code-review, versioning, breaking-change]
dependencies: []
---

## Problem Statement

This PR contains multiple breaking changes to the public API of `@emarketeer/ts-microservice-commons`:

- `EmLambdaFunction`: removed `getFunction()`, `getFunctionArn()`, `getFunctionName()`, `grantInvoke()` public methods
- `LambdaWithQueueProps`: removed `snsTopics` and `rawMessageDelivery` fields
- `LambdaConfig`: `retryAttempts` default changed from `2` (explicit) to `undefined` (implicit CDK default)
- `createLambdaFunction` helper export removed

Under semver, any removal of public API is a breaking change requiring a major version bump. The current version is in the `7.x` beta series; the next release should be `8.0.0-beta.x` or equivalent.

## Findings

- `src/cdk/constructs/lambda.ts` — four public methods removed
- `src/cdk/constructs/lambda-with-queue.ts` — two props removed
- Only one known consumer (screenshot-service) — impact is contained but the version contract must be honoured

## Proposed Solutions

### Option A: Increment major version in semantic-release config
Add a note in the PR description that this is a breaking change (`BREAKING CHANGE:` in commit footer) so semantic-release bumps major.

### Option B: Restore removed methods as deprecated
Re-add the removed methods with `@deprecated` JSDoc and a forwarding implementation, bumping minor instead.

## Acceptance Criteria
- [ ] PR commit message or footer contains `BREAKING CHANGE:` to trigger major semver bump
- [ ] OR removed methods are restored with deprecation notices
