---
name: addCustomDomain construct ID collision when same domain used across multiple EmHttpApi instances
description: safeId derived from domainName+path can produce the same sanitized string for different inputs, causing CDK ID collision
type: finding
status: pending
priority: p2
issue_id: "036"
tags: [code-review, architecture, cdk]
dependencies: []
---

## Problem Statement

`EmHttpApi.addCustomDomain` in `src/cdk/constructs/api-gateway.ts` derives its child construct IDs from `${domainName}${normalisedPath}` sanitized to alphanumeric only. Two different domain+path combinations can produce the same sanitized string (e.g. `api.foo.com/v1` and `apifoo.comv1`). Additionally, if two `EmHttpApi` instances in the same stack both call `addCustomDomain` with the same physical domain name, two `DomainName` resources are synthesized — CloudFormation rejects duplicate domain names at deploy time.

## Findings

- `src/cdk/constructs/api-gateway.ts:248` — `safeId` derivation via regex replace
- No guard against duplicate `DomainName` resources
- Collision example: `api-foo.com` + `/v1` → `apifoomv1`; `api-foo.comv1` + `` → `apifoomcomv1` — actually distinct, but edge cases exist

## Proposed Solutions

### Option A: Accept caller-provided logical ID (Recommended)
Add `id: string` as first parameter of `addCustomDomain`. Gives callers explicit control.

### Option B: Use hash of domain+path
Use a short hash suffix on `safeId` to avoid collisions while remaining stable.

## Acceptance Criteria
- [ ] Two calls with different domain+path cannot produce the same child construct ID
- [ ] Same domain used in two EmHttpApi instances is documented as unsupported or guarded
