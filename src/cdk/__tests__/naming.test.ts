/**
 * Tests for naming utilities
 */

import {
  generateStackName,
  generateResourceName,
  generateLambdaName,
  generateTableName,
  isValidStage
} from '../utils/naming'

describe('Naming Utilities', () => {
  describe('generateStackName', () => {
    it('should generate correct stack name', () => {
      const result = generateStackName({
        stage: 'dev',
        serviceName: 'contacts'
      })
      expect(result).toBe('dev-contacts-stack')
    })
  })

  describe('generateResourceName', () => {
    it('should generate resource name with all parts', () => {
      const result = generateResourceName({
        stage: 'prod',
        serviceName: 'orders',
        resourceType: 'lambda',
        resourceName: 'handler'
      })
      expect(result).toBe('prod-orders-lambda-handler')
    })
  })

  describe('generateLambdaName', () => {
    it('should generate correct lambda name', () => {
      const result = generateLambdaName('test', 'users', 'get-user')
      expect(result).toBe('test-users-lambda-get-user')
    })
  })

  describe('isValidStage', () => {
    it('should validate correct stages', () => {
      expect(isValidStage('dev')).toBe(true)
      expect(isValidStage('test')).toBe(true)
      expect(isValidStage('staging')).toBe(true)
      expect(isValidStage('prod')).toBe(true)
    })

    it('should reject invalid stages', () => {
      expect(isValidStage('invalid')).toBe(false)
    })
  })
})
