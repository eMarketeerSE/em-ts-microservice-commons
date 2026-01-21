# CDK Commons Changelog

## [Unreleased]

### Added (Initial Release)

#### Constructs
- **Lambda Functions**: `EmLambdaFunction` construct with standardized configurations
  - Support for Node.js 22.x runtime
  - ARM64 architecture by default
  - Automatic log retention configuration
  - X-Ray tracing support
  
- **DynamoDB Tables**: `EmDynamoDBTable` construct with common patterns
  - Single-table design helpers (`createSingleTable`)
  - Key-value table helpers (`createKeyValueTable`)
  - GSI pattern presets (by attribute, by status/timestamp, single-table GSI)
  - Point-in-time recovery and encryption enabled by default for production
  
- **API Gateway**: REST and HTTP API constructs
  - `EmRestApi` for REST APIs with access logging
  - `EmHttpApi` for HTTP APIs (faster and cheaper)
  - CORS configuration support
  - Easy Lambda integration methods
  
- **SQS Queues**: `EmSqsQueue` construct with DLQ support
  - Standard and FIFO queue support
  - Automatic DLQ creation and configuration
  - Helper functions for common patterns
  
- **SNS Topics**: `EmSnsTopic` construct
  - Standard and FIFO topic support
  - Easy subscription methods (Lambda, SQS, Email)
  
- **EventBridge Rules**: `EmEventBridgeRule` construct
  - Schedule expression support (rate and cron)
  - Event pattern support
  - Common event pattern presets
  - Multiple target types (Lambda, SQS, SNS)

#### Utilities

- **Naming Conventions**:
  - `generateStackName()`, `generateResourceName()`
  - Service-specific generators for Lambda, DynamoDB, API Gateway, SQS, SNS, EventBridge
  - Log group and IAM role name generators
  
- **Tagging Strategies**:
  - `applyStandardTags()` for consistent tagging
  - Environment-specific tags
  - Cost allocation tags
  - Compliance tags
  
- **Environment Configuration**:
  - Stage-specific configuration management
  - Environment variable helpers
  - Resource limit presets by stage
  - Tracing and alarm threshold configurations
  
- **IAM Helpers**:
  - Lambda execution role creation
  - DynamoDB access policies (read, write, read/write)
  - SQS, SNS, S3, Secrets Manager, SSM Parameter Store policies
  - X-Ray tracing, EventBridge, CloudWatch Logs policies
  - KMS, Lambda invoke, Step Functions policies
  
- **CloudWatch Logs**:
  - Stage-based log retention configuration
  - Log group creation helpers
  - Lambda and API Gateway specific log groups
  - Removal policy management

#### Configuration Presets

- **Lambda Presets**: Small, Medium, Large, XLarge, API Handler, Queue Processor, Scheduled Job
- **DynamoDB Presets**: Pay-per-request, Provisioned, Single-table, Simple ID, Time-series
- **SQS Presets**: Standard, Long-running, FIFO
- **CORS Presets**: Allow All, Strict, Read-only

#### Documentation

- Comprehensive README with:
  - Installation instructions
  - Quick start guide
  - Detailed construct documentation
  - Utility function examples
  - Best practices
  - Migration guide from Serverless Framework
  
- Example implementations:
  - Basic stack (Lambda + DynamoDB)
  - API stack (REST API + multiple Lambdas)
  - Queue stack (SQS + SNS + Lambda processor)

#### Type Definitions

- Full TypeScript type definitions for all constructs and utilities
- Configuration interfaces for all AWS services
- Stage type definition with validation
- Environment configuration types

### Standards

- Follows eMarketeer infrastructure patterns
- Compatible with existing Serverless Framework deployments
- Supports multi-stage deployments (dev, test, staging, prod)
- ARM64 architecture by default (cost-effective)
- Pay-per-request billing for DynamoDB by default
- Automatic tagging for cost allocation
- Stage-appropriate resource retention policies

