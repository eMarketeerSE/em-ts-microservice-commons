/**
 * Common DynamoDB table construct with standard configurations
 */

import { RemovalPolicy } from 'aws-cdk-lib'
import {
  Table,
  AttributeType,
  BillingMode,
  StreamViewType,
  ProjectionType,
  TableEncryption
} from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import { DynamoDBTableConfig, DynamoDBGSIConfig } from '../types'
import { generateTableName } from '../utils/naming'
import { applyStandardTags } from '../utils/tagging'
import { getRemovalPolicy } from '../utils/logs'

/**
 * Standard DynamoDB table construct with eMarketeer defaults
 */
export class EmDynamoDBTable extends Construct {
  public readonly table: Table

  constructor(scope: Construct, id: string, config: DynamoDBTableConfig) {
    super(scope, id)

    const tableName = generateTableName(config.stage, config.serviceName, config.tableName)

    // Create DynamoDB table
    this.table = new Table(this, `${id}Table`, {
      tableName,
      partitionKey: config.partitionKey,
      sortKey: config.sortKey,
      billingMode: config.billingMode || BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.pointInTimeRecovery ?? config.stage === 'prod',
      stream: config.stream ? StreamViewType.NEW_AND_OLD_IMAGES : undefined,
      timeToLiveAttribute: config.timeToLiveAttribute,
      encryption: TableEncryption.AWS_MANAGED,
      removalPolicy: getRemovalPolicy(config.stage)
    })

    // Add Global Secondary Indexes
    if (config.globalSecondaryIndexes) {
      config.globalSecondaryIndexes.forEach(gsi => {
        this.addGlobalSecondaryIndex(gsi)
      })
    }

    // Apply standard tags
    applyStandardTags(this.table, {
      stage: config.stage,
      serviceName: config.serviceName,
      ...config.tags
    })
  }

  /**
   * Add a Global Secondary Index to the table
   */
  private addGlobalSecondaryIndex(gsiConfig: DynamoDBGSIConfig): void {
    this.table.addGlobalSecondaryIndex({
      indexName: gsiConfig.indexName,
      partitionKey: gsiConfig.partitionKey,
      sortKey: gsiConfig.sortKey,
      projectionType: gsiConfig.projectionType || ProjectionType.ALL,
      nonKeyAttributes: gsiConfig.nonKeyAttributes
    })
  }

  /**
   * Get the table
   */
  public getTable(): Table {
    return this.table
  }

  /**
   * Get the table ARN
   */
  public getTableArn(): string {
    return this.table.tableArn
  }

  /**
   * Get the table name
   */
  public getTableName(): string {
    return this.table.tableName
  }

  /**
   * Grant read permissions to a grantee
   */
  public grantReadData(grantee: any) {
    return this.table.grantReadData(grantee)
  }

  /**
   * Grant write permissions to a grantee
   */
  public grantWriteData(grantee: any) {
    return this.table.grantWriteData(grantee)
  }

  /**
   * Grant read/write permissions to a grantee
   */
  public grantReadWriteData(grantee: any) {
    return this.table.grantReadWriteData(grantee)
  }

  /**
   * Grant stream read permissions to a grantee
   */
  public grantStreamRead(grantee: any) {
    return this.table.grantStreamRead(grantee)
  }
}

/**
 * Helper function to create a DynamoDB table with single-table design pattern
 */
export const createSingleTable = (
  scope: Construct,
  id: string,
  config: Omit<DynamoDBTableConfig, 'partitionKey' | 'sortKey'>
): EmDynamoDBTable => {
  return new EmDynamoDBTable(scope, id, {
    ...config,
    partitionKey: {
      name: 'PK',
      type: AttributeType.STRING
    },
    sortKey: {
      name: 'SK',
      type: AttributeType.STRING
    }
  })
}

/**
 * Helper function to create a simple key-value table
 */
export const createKeyValueTable = (
  scope: Construct,
  id: string,
  config: Omit<DynamoDBTableConfig, 'partitionKey'>
): EmDynamoDBTable => {
  return new EmDynamoDBTable(scope, id, {
    ...config,
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING
    }
  })
}

/**
 * Common GSI configurations
 */
export const GSI_PATTERNS = {
  /**
   * GSI for querying by a secondary attribute
   */
  byAttribute: (attributeName: string, indexName?: string): DynamoDBGSIConfig => ({
    indexName: indexName || `${attributeName}Index`,
    partitionKey: {
      name: attributeName,
      type: AttributeType.STRING
    },
    projectionType: ProjectionType.ALL
  }),

  /**
   * GSI for querying by status and timestamp
   */
  byStatusAndTimestamp: (indexName = 'StatusTimestampIndex'): DynamoDBGSIConfig => ({
    indexName,
    partitionKey: {
      name: 'status',
      type: AttributeType.STRING
    },
    sortKey: {
      name: 'timestamp',
      type: AttributeType.NUMBER
    },
    projectionType: ProjectionType.ALL
  }),

  /**
   * GSI for single-table design pattern
   */
  singleTableGSI: (indexName = 'GSI1'): DynamoDBGSIConfig => ({
    indexName,
    partitionKey: {
      name: 'GSI1PK',
      type: AttributeType.STRING
    },
    sortKey: {
      name: 'GSI1SK',
      type: AttributeType.STRING
    },
    projectionType: ProjectionType.ALL
  })
}
