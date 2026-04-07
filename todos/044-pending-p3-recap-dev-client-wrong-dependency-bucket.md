---
name: @recap.dev/client in dependencies instead of peerDependencies
description: Library packages should declare shared runtime deps as peerDependencies to avoid duplicate installs in consumers
type: finding
status: pending
priority: p3
issue_id: "044"
tags: [code-review, package, dependencies]
dependencies: []
---

## Problem Statement

`@recap.dev/client` is added to `dependencies` in `package.json`. As a library package, `@emarketeer/ts-microservice-commons` is installed inside consumer services. Declaring `@recap.dev/client` as a `dependency` means it will be installed in every consumer's `node_modules` even if the consumer does not use it directly. It may also result in version conflicts with a consumer's own `@recap.dev/client` install. It belongs in `peerDependencies`.

Similarly, `esbuild` is a build-time tool used only by `build-handlers.js` — it belongs in `devDependencies` (for local dev) and `peerDependencies` (for consumers who invoke the `./build-handlers` export).

## Findings

- `package.json:99` — `@recap.dev/client` in `dependencies`
- `package.json:108` — `esbuild` in `dependencies`
- Both should not be forced onto consumers as transitive runtime dependencies

## Proposed Solutions

### Option A: Move to peerDependencies
Move `@recap.dev/client` and `esbuild` to `peerDependencies`. Keep in `devDependencies` for local use.

## Acceptance Criteria
- [ ] `@recap.dev/client` in `peerDependencies`, not `dependencies`
- [ ] `esbuild` in `peerDependencies` + `devDependencies`, removed from `dependencies`
- [ ] Consumer services install these explicitly
