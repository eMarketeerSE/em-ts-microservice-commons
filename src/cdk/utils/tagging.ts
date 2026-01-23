/**
 * Tagging strategies and utilities
 */

import { Tags } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { TaggingConfig } from '../types'

/**
 * Standard tags applied to all resources
 */
export interface StandardTags {
  Stage: string
  Service: string
  ManagedBy: string
  Owner?: string
  CostCenter?: string
  Project?: string
}

/**
 * Generate standard tags for a resource
 */
export const generateStandardTags = (config: TaggingConfig): StandardTags => {
  const tags: StandardTags = {
    Stage: config.stage,
    Service: config.serviceName,
    ManagedBy: 'CDK'
  }

  if (config.owner) {
    tags.Owner = config.owner
  }

  if (config.costCenter) {
    tags.CostCenter = config.costCenter
  }

  if (config.project) {
    tags.Project = config.project
  }

  return tags
}

/**
 * Apply standard tags to a construct
 */
export const applyStandardTags = (construct: Construct, config: TaggingConfig): void => {
  const standardTags = generateStandardTags(config)

  Object.entries(standardTags).forEach(([key, value]) => {
    if (value) {
      Tags.of(construct).add(key, value)
    }
  })

  if (config.customTags) {
    Object.entries(config.customTags).forEach(([key, value]) => {
      Tags.of(construct).add(key, value)
    })
  }
}

/**
 * Apply tags from a simple record
 */
export const applyTags = (construct: Construct, tags: Record<string, string>): void => {
  Object.entries(tags).forEach(([key, value]) => {
    Tags.of(construct).add(key, value)
  })
}

/**
 * Merge multiple tag sets
 */
export const mergeTags = (...tagSets: Record<string, string>[]): Record<string, string> => {
  return Object.assign({}, ...tagSets)
}

/**
 * Generate environment-specific tags
 */
export const getEnvironmentTags = (stage: string): Record<string, string> => {
  const tags: Record<string, string> = {
    Stage: stage
  }

  switch (stage) {
    case 'prod':
      tags.Environment = 'production'
      tags.Tier = 'production'
      break
    case 'staging':
      tags.Environment = 'staging'
      tags.Tier = 'pre-production'
      break
    case 'test':
      tags.Environment = 'test'
      tags.Tier = 'testing'
      break
    case 'dev':
      tags.Environment = 'development'
      tags.Tier = 'development'
      break
  }

  return tags
}

/**
 * Generate cost allocation tags
 */
export const getCostAllocationTags = (
  serviceName: string,
  costCenter?: string,
  project?: string
): Record<string, string> => {
  const tags: Record<string, string> = {
    Service: serviceName
  }

  if (costCenter) {
    tags.CostCenter = costCenter
  }

  if (project) {
    tags.Project = project
  }

  return tags
}

/**
 * Generate compliance tags
 */
export const getComplianceTags = (
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted',
  compliance?: string[]
): Record<string, string> => {
  const tags: Record<string, string> = {}

  if (dataClassification) {
    tags.DataClassification = dataClassification
  }

  if (compliance && compliance.length > 0) {
    tags.Compliance = compliance.join(',')
  }

  return tags
}
