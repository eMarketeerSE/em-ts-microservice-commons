---
name: esbuild build call missing minify:true and external:['@aws-sdk/*']
description: Bundle size regression from NodejsFunction migration — no minification and AWS SDK bundled unnecessarily
type: finding
status: pending
priority: p2
issue_id: "035"
tags: [code-review, performance, lambda, esbuild]
dependencies: []
---

## Problem Statement

`src/build-handlers.js` esbuild call omits `minify: true` and `external: ['@aws-sdk/*']`. The previous `NodejsFunction` config had `minify: true`. Lambda runtimes (Node 22) ship with `@aws-sdk/client-*` v3 — bundling it adds 1–5 MB per client. Bundle size directly affects Lambda cold start duration.

## Findings

- `src/build-handlers.js:45-54` — no `minify`, no `treeShaking`, no `external`
- Previous NodejsFunction config had `minify: true` — this is a regression
- Any handler using `@aws-sdk/*` will bundle the full SDK rather than using the runtime copy
- Expected impact: 20–40% bundle size reduction from minify; 1–5 MB reduction per AWS client from external

## Proposed Solutions

### Option A: Add both (Recommended)
```js
esbuild.build({
  ...
  minify: true,
  treeShaking: true,
  external: ['@aws-sdk/*'],
})
```

### Option B: Make configurable
Accept `--external` and `--minify` flags, defaulting to the above.

## Acceptance Criteria
- [ ] Built handlers are minified (file size noticeably smaller)
- [ ] `@aws-sdk/*` not present in bundle output
- [ ] No functional regression in handler behaviour
