---
name: build-handlers.js has no --help flag and no malformed-argument detection
description: CLI tool provides no usage documentation and silently falls back to defaults on bad arguments — hard to debug in CI
type: finding
status: pending
priority: p3
issue_id: "046"
tags: [code-review, quality, cli, build-tools]
dependencies: []
---

## Problem Statement

`src/build-handlers.js` accepts `--handlers-dir` and `--out-dir` but provides no `--help` output and no detection of malformed arguments. If `--handlers-dir` is passed without a following value (next token is another flag), the script silently uses the default `src/handlers`. If that directory exists, the build proceeds with the wrong input — this is difficult to debug in CI logs.

## Findings

- `src/build-handlers.js:13-15` — no `--help` / `-h` check
- `src/build-handlers.js:14` — `args[handlersDirIndex + 1]` not validated to be a non-flag value
- No usage line printed on any error path

## Proposed Solutions

### Option A: Add --help and malformed-arg detection (Recommended)
```js
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: build-handlers [--handlers-dir <dir>] [--out-dir <dir>]')
  console.log('  --handlers-dir  Source directory (default: src/handlers)')
  console.log('  --out-dir       Output directory (default: dist/handlers)')
  process.exit(0)
}
const nextHandlersArg = args[handlersDirIndex + 1]
if (nextHandlersArg?.startsWith('--')) {
  console.error('--handlers-dir requires a directory argument')
  process.exit(1)
}
```

## Acceptance Criteria
- [ ] `--help` prints usage and exits 0
- [ ] `--handlers-dir` followed by another flag exits 1 with clear error
- [ ] Normal invocation unchanged
