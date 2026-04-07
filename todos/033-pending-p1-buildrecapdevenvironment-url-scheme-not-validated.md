---
name: buildRecapDevEnvironment URL scheme not validated (SSRF risk residual)
description: new URL() check passes non-HTTPS schemes like file://, ftp://, http://169.254.169.254 — scheme must be explicitly validated
type: finding
status: pending
priority: p1
issue_id: "033"
tags: [code-review, security, ssrf]
dependencies: []
---

## Problem Statement

`buildRecapDevEnvironment` in `src/cdk/utils/config.ts` validates the recap.dev endpoint using `new URL(endpoint)`, which only checks structural validity — not the scheme. Values such as `file:///etc/passwd`, `ftp://internal`, and `http://169.254.169.254/latest/meta-data/` all pass without error and are injected verbatim as `RECAP_DEV_SYNC_ENDPOINT` into every Lambda environment. Todo 001 addressed the injection path; this is the residual gap in the validation itself.

## Findings

- `src/cdk/utils/config.ts:185` — `new URL(endpoint)` passes any RFC-3986 scheme
- `http://169.254.169.254` (EC2 IMDS) passes — SSRF to AWS credential metadata
- No `https:`-only enforcement even for prod stages

## Proposed Solutions

### Option A: Explicit scheme check (Recommended)
After `new URL(endpoint)` succeeds, assert:
```ts
const parsed = new URL(endpoint)
if (!['https:', 'http:'].includes(parsed.protocol)) {
  throw new Error(`recap.dev endpoint must use http or https, got: ${parsed.protocol}`)
}
```
For prod, additionally reject `http:`.

### Option B: Regex pre-check
Validate with `/^https?:\/\//` before parsing. Simpler but less informative on failure.

## Acceptance Criteria
- [ ] `file://`, `ftp://`, `javascript:`, `data:` schemes throw at synth time
- [ ] `http://169.254.169.254` is blocked (or at minimum non-https rejected in prod)
- [ ] Valid `https://` endpoints continue to work
- [ ] Test added to cover invalid scheme cases
