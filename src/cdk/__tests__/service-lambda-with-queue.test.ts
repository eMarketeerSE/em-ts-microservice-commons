import { App, Duration, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { ServiceLambdaWithQueue } from '../constructs/service-lambda-with-queue'

const CODE_PATH = __dirname

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

describe('ServiceLambdaWithQueue', () => {
  describe('synth', () => {
    it('synthesises without error', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      expect(
        () =>
          new ServiceLambdaWithQueue(stack, 'Subject', {
            stage: 'dev',
            serviceName: 'my-service',
            functionName: 'my-handler',
            queueBaseName: 'jobs',
            memorySize: 512,
            timeout: Duration.seconds(30),
            enableTracing: false,
            alarmTopic,
            codePath: CODE_PATH
          })
      ).not.toThrow()
    })
  })

  describe('naming', () => {
    it('generates function name as stage-serviceName-functionName', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      new ServiceLambdaWithQueue(stack, 'Subject', {
        stage: 'dev',
        serviceName: 'my-service',
        functionName: 'my-handler',
        queueBaseName: 'jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        codePath: CODE_PATH
      })
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-my-service-my-handler'
      })
    })

    it('generates queue name as stage-serviceName-queue-queueBaseName', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      new ServiceLambdaWithQueue(stack, 'Subject', {
        stage: 'dev',
        serviceName: 'my-service',
        functionName: 'my-handler',
        queueBaseName: 'jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        codePath: CODE_PATH
      })
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'dev-my-service-queue-jobs'
      })
    })

    it('generates DLQ name with -dlq suffix', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      new ServiceLambdaWithQueue(stack, 'Subject', {
        stage: 'dev',
        serviceName: 'my-service',
        functionName: 'my-handler',
        queueBaseName: 'jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        codePath: CODE_PATH
      })
      Template.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'dev-my-service-queue-jobs-dlq'
      })
    })

    it('alarm name uses the short functionName not the generated one', () => {
      const stack = makeStack()
      const alarmTopic = new Topic(stack, 'AlarmTopic')
      new ServiceLambdaWithQueue(stack, 'Subject', {
        stage: 'dev',
        serviceName: 'my-service',
        functionName: 'my-handler',
        queueBaseName: 'jobs',
        memorySize: 512,
        timeout: Duration.seconds(30),
        enableTracing: false,
        alarmTopic,
        codePath: CODE_PATH
      })
      Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-my-service-my-handler-dlq-alarm'
      })
    })
  })
})
