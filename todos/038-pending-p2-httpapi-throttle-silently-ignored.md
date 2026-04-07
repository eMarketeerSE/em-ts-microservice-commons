---
name: HttpApiConfig.throttle declared in types but silently ignored in EmHttpApi
description: Callers setting throttle config get no throttling applied and no warning — misleading public API
type: finding
status: pending
priority: p2
issue_id: "038"
tags: [code-review, quality, api-gateway]
dependencies: []
---

## Problem Statement

`HttpApiConfig` in `src/cdk/types/common.ts` declares a `throttle?: { rateLimit?: number; burstLimit?: number }` field. `EmHttpApi` in `src/cdk/constructs/api-gateway.ts` never reads this field. AWS HTTP APIs support throttling via default route settings. Callers who set `throttle` believe their configuration is applied; it is silently dropped.

## Findings

- `src/cdk/types/common.ts:141-144` — `throttle` field declared
- `src/cdk/constructs/api-gateway.ts` — no reference to `config.throttle` anywhere
- AWS HTTP API default route settings prop: `HttpApi.defaultRouteSettings.throttlingRateLimit`

## Proposed Solutions

### Option A: Wire throttle into HttpApi (Recommended)
```ts
this.api = new HttpApi(this, `${id}Api`, {
  ...
  defaultRouteSettings: config.throttle ? {
    throttlingRateLimit: config.throttle.rateLimit,
    throttlingBurstLimit: config.throttle.burstLimit,
  } : undefined
})
```

### Option B: Remove the field
Remove `throttle` from `HttpApiConfig` until it is implemented. Prevents silent misconfiguration.

## Acceptance Criteria
- [ ] Setting `throttle.rateLimit: 100` results in a `DefaultRouteSettings` in the synthesized CloudFormation template
- [ ] OR `throttle` field is removed from `HttpApiConfig`
