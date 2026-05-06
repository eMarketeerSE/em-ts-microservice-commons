# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`@emarketeer/ts-microservice-commons` is a shared library consumed by all eMarketeer TypeScript microservices. It provides:

1. **AWS CDK v2 constructs** (`./cdk` export) — opinionated wrappers for Lambda, DynamoDB, API Gateway, SQS, SNS, EventBridge
2. **em-commons CLI** — wraps ESLint, TSC, Jest, and CDK deploy/synth/test for consuming services
3. **Shared configs** — Jest, ESLint, Serverless, exported for microservices to use
4. **handler-bundler** — internal esbuild bundler invoked by the CDK Lambda construct at synth time (one subprocess per handler)

This repo is the library itself, not a microservice. Changes here affect every downstream service.

## Commands

```bash
npm run build          # Rollup build (CDK, jest config, handler-bundler, em-commons CLI)
npm run start          # Rollup watch mode
npm test               # Jest with coverage (src/*.ts only)
npm run test:cdk       # CDK construct tests (src/cdk/__tests__/)
npm run lint           # tslint
```

Run a single CDK test:
```bash
npx jest --config jest.cdk.config.ts --testPathPattern='lambda.test'
```

## Architecture

### Package Exports

One public entry point in `package.json` `"exports"`:
- `@emarketeer/ts-microservice-commons/cdk` — CDK constructs and utilities (ESM + CJS)

Plus the `em-commons` binary at `dist/lib/em-commons.js` and the internal `dist/handler-bundler.js` script (invoked by the CDK Lambda construct via `execFileSync`; not a public API).

### Source Layout

- `src/cdk/` — CDK v2 constructs, types, and utilities. This is the main active area of development.
  - `constructs/` — `EmStack` (base stack class), `EmLambdaFunction`, `EmDynamoDBTable`, `EmRestApi`, `EmHttpApi`, `EmSqsQueue`, `EmSnsTopic`, `EmEventBridgeRule`, plus pattern constructs (LambdaWithQueue, ServiceLambdaWithQueue, LambdaWithHttpApi, DLQAlarm)
  - `utils/` — naming conventions, tagging, IAM policy builders, config (stage-based defaults), logging, RDS/VPC helpers, serverless-migration (logical ID overrides), cdk-app (CDK entry point helper), bundling (`resolveLambdaCode` + `BundlingOverrides`)
  - `types/` — all CDK type interfaces in `common.ts`. Stage is `'dev' | 'test' | 'staging' | 'prod'`
  - `examples/` — reference stack implementations
- `src/em-commons.ts` — CLI entry point that wraps lint/tsc/jest and the CDK deploy/synth/test commands
- `src/handler-bundler.ts` — single-handler esbuild bundler (recap.dev handler wrapper, MySQL2 auto-wrapper, `@emarketeer/esbuild-plugin-tsc` for decorator metadata). Reads `{ entry, outDir, overrides? }` from stdin. Invoked by `resolveLambdaCode` via subprocess to bridge CDK's sync `local.tryBundle` hook to async esbuild + plugins.
- `src/jest.config.ts` — shared Jest config exported to consuming services (rootDir points 5 levels up)
- `src/common.serverless.ts` — base Serverless Framework config (Node 22, ARM64, eu-west-1, 1024MB, 15s timeout)

### Build System

Rollup produces 4 outputs:
1. CDK module (ESM at `dist/cdk/index.js` + CJS at `dist/cdk/cjs/index.js`)
2. Jest config (`dist/lib/jest.config.js`)
3. handler-bundler (`dist/handler-bundler.js`)
4. em-commons CLI (`dist/lib/em-commons.js` with shebang)

### CDK Conventions

All constructs follow a pattern: they accept a config object with `stage`, `serviceName`, and resource-specific options. Stage drives defaults for memory, timeouts, log retention, throttling, alarms, and removal policies (RETAIN in prod, DESTROY otherwise).

Naming utilities (`generateLambdaName`, `generateTableName`, etc.) produce consistent resource names across all services.

### EmStack and Serverless Migration

`EmStack` is the base stack class for all microservices. It auto-generates stack names, descriptions, and applies standard tags. Services use `this.createFunction()` to create Lambdas and `this.addOutput()` for exports.

For services migrating from Serverless Framework, pass `useSharedRole: true` — this enables migration mode:
- Creates a shared IAM role pinned to `IamRoleLambdaExecution`
- `createFunction()` overrides Lambda + log group logical IDs to match Serverless naming
- Log groups get RETAIN removal policy to protect existing data

`createEmApp()` is the CDK app entry helper — reads stage from `-c stage=...` context, defaults to `'dev'`, returns typed `Stage`.

### Testing

- CDK tests in `src/cdk/__tests__/` use CDK assertions (`aws-cdk-lib/assertions`)
- Root-level Jest config covers `src/*.ts` with 95% line/statement and 90% branch thresholds
- CDK Jest config (`jest.cdk.config.ts`) covers `src/cdk/__tests__/` separately

### Release

Uses semantic-release with conventional commits. Commit messages must follow conventional format (enforced by commitlint).

## Key Peer Dependencies

Consuming services must provide: `aws-cdk-lib` (^2.0.0), `constructs` (^10.0.0), `@recap.dev/client` (^4.3.0).
