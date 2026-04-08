# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`@emarketeer/ts-microservice-commons` is a shared library consumed by all eMarketeer TypeScript microservices. It provides:

1. **AWS CDK v2 constructs** (`./cdk` export) — opinionated wrappers for Lambda, DynamoDB, API Gateway, SQS, SNS, EventBridge
2. **em-commons CLI** — wraps Serverless Framework, ESLint, TSC, Jest, and esbuild for consuming services
3. **Shared configs** — Jest, ESLint, Serverless, esbuild plugins, exported for microservices to use
4. **build-handlers** — esbuild-based Lambda handler builder (`./build-handlers` export)

This repo is the library itself, not a microservice. Changes here affect every downstream service.

## Commands

```bash
npm run build          # Rollup build (CDK, jest config, build-handlers, em-commons CLI)
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

Three entry points in `package.json` `"exports"`:
- `@emarketeer/ts-microservice-commons/cdk` — CDK constructs and utilities (ESM + CJS)
- `@emarketeer/ts-microservice-commons/esbuild-plugins` — recap.dev wrapper + TSC plugin
- `@emarketeer/ts-microservice-commons/build-handlers` — CLI tool for building Lambda handlers with esbuild

Plus the `em-commons` binary at `dist/lib/em-commons.js`.

### Source Layout

- `src/cdk/` — CDK v2 constructs, types, and utilities. This is the main active area of development.
  - `constructs/` — `EmLambdaFunction`, `EmDynamoDBTable`, `EmRestApi`, `EmHttpApi`, `EmSqsQueue`, `EmSnsTopic`, `EmEventBridgeRule`, plus pattern constructs (LambdaWithQueue, ServiceLambdaWithQueue, LambdaWithHttpApi, DLQAlarm)
  - `utils/` — naming conventions, tagging, IAM policy builders, config (stage-based defaults), logging, RDS/VPC helpers
  - `types/` — all CDK type interfaces in `common.ts`. Stage is `'dev' | 'test' | 'staging' | 'prod'`
  - `examples/` — reference stack implementations
- `src/em-commons.ts` — CLI entry point that wraps lint/tsc/jest/deploy/invoke-local/build-handlers
- `src/jest.config.ts` — shared Jest config exported to consuming services (rootDir points 5 levels up)
- `src/common.serverless.ts` — base Serverless Framework config (Node 22, ARM64, eu-west-1, 1024MB, 15s timeout)
- `src/build-handlers.ts` — esbuild bundler for Lambda handlers (defaults: `src/handlers` → `dist/handlers`, target `node24`)
- `src/esbuild-plugins.js` — recap.dev handler wrapper, MySQL2 auto-wrapper, TSC plugin

### Build System

Rollup produces 4 outputs:
1. CDK module (ESM at `dist/cdk/index.js` + CJS at `dist/cdk/cjs/index.js`)
2. Jest config (`dist/lib/jest.config.js`)
3. build-handlers (`dist/build-handlers.js`)
4. em-commons CLI (`dist/lib/em-commons.js` with shebang)

### CDK Conventions

All constructs follow a pattern: they accept a config object with `stage`, `serviceName`, and resource-specific options. Stage drives defaults for memory, timeouts, log retention, throttling, alarms, and removal policies (RETAIN in prod, DESTROY otherwise).

Naming utilities (`generateLambdaName`, `generateTableName`, etc.) produce consistent resource names across all services.

### Testing

- CDK tests in `src/cdk/__tests__/` use CDK assertions (`aws-cdk-lib/assertions`)
- Root-level Jest config covers `src/*.ts` with 95% line/statement and 90% branch thresholds
- CDK Jest config (`jest.cdk.config.ts`) covers `src/cdk/__tests__/` separately

### Release

Uses semantic-release with conventional commits. Commit messages must follow conventional format (enforced by commitlint).

## Key Peer Dependencies

Consuming services must provide: `aws-cdk-lib` (^2.0.0), `constructs` (^10.0.0), `@recap.dev/client` (^4.3.0).
