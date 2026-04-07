---
name: build-handlers.js path traversal via --handlers-dir and --out-dir
description: CLI arguments are not bounds-checked against rootDir — arbitrary file reads and writes possible during CI builds
type: finding
status: pending
priority: p2
issue_id: "034"
tags: [code-review, security, build-tools]
dependencies: []
---

## Problem Statement

`src/build-handlers.js` reads `--handlers-dir` and `--out-dir` directly from `process.argv` and joins them to `process.cwd()` via `path.join` with no validation. `path.join('/project', '../../.ssh')` resolves to `/.ssh`. A crafted CI argument or compromised build script can cause esbuild to read files from anywhere on the host filesystem and write bundle output outside the project tree.

## Findings

- `src/build-handlers.js:14-18` — `handlersDir` and `outDir` taken directly from argv
- `src/build-handlers.js:20` — `path.join(rootDir, handlersDir)` with no bounds check
- `path.join('/project', '../../etc/passwd')` → `/etc/passwd`

## Proposed Solutions

### Option A: Bounds check after join (Recommended)
```js
const absoluteHandlersDir = path.join(rootDir, handlersDir)
if (!absoluteHandlersDir.startsWith(rootDir + path.sep)) {
  console.error('--handlers-dir must be inside the project root')
  process.exit(1)
}
// same for outDir
```

### Option B: Resolve and compare
Use `path.resolve()` and compare with `path.resolve(rootDir)`.

## Acceptance Criteria
- [ ] `--handlers-dir ../../.ssh` exits 1 with clear error message
- [ ] `--out-dir /tmp/evil` exits 1 with clear error message
- [ ] Normal relative paths like `src/handlers` still work
