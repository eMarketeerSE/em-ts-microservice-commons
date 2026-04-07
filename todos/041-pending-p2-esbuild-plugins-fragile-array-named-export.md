---
name: esbuild-plugins.js exports array with named property attached — fragile CJS pattern
description: module.exports is an array, recapDevHandlerWrapper is attached as a named property on that array — breaks in ESM and is non-obvious
type: finding
status: pending
priority: p2
issue_id: "041"
tags: [code-review, quality, esbuild, build-tools]
dependencies: []
---

## Problem Statement

`src/esbuild-plugins.js` sets `module.exports = [recapDevAutoWrapper, esbuildPluginTsc()]` (an array), then adds `module.exports.recapDevHandlerWrapper = recapDevHandlerWrapper` as a named property on that array. This works in CJS because arrays are objects. `src/build-handlers.js` destructures the named property with `const { recapDevHandlerWrapper } = plugins`. However: (1) the pattern is non-obvious and will confuse future maintainers; (2) the `package.json` exports map exposes this as `"./esbuild-plugins"` which may be consumed as ESM by some toolchains, where named properties on `module.exports` are not automatically available as named ESM exports.

## Findings

- `src/esbuild-plugins.js:73-75` — array assigned to `module.exports`, named prop attached after
- `src/build-handlers.js:8` — `const { recapDevHandlerWrapper } = plugins` (array destructure)
- `src/build-handlers.js:53` — `[recapDevHandlerWrapper, ...plugins]` — spreads the array correctly but relies on the above fragile pattern

## Proposed Solutions

### Option A: Export a plain object (Recommended)
```js
module.exports = {
  defaultPlugins: [recapDevAutoWrapper, esbuildPluginTsc()],
  recapDevHandlerWrapper,
}
```
Update `build-handlers.js` to use `const { defaultPlugins, recapDevHandlerWrapper } = require('./esbuild-plugins')`.

### Option B: Two separate exports
Keep the default array export and add a separate named-exports file for `recapDevHandlerWrapper`.

## Acceptance Criteria
- [ ] `esbuild-plugins.js` exports a plain object or a clearly typed module structure
- [ ] `build-handlers.js` imports without relying on named properties on an array
- [ ] No behaviour change to the esbuild plugin pipeline
