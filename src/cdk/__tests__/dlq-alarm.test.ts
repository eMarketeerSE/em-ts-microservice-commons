import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { DlqAlarm } from '../constructs/dlq-alarm'

function makeStack() {
  const app = new App()
  return new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'eu-west-1' } })
}

describe('DlqAlarm', () => {
  it('alarms on ApproximateNumberOfMessagesVisible > 0', () => {
    const stack = makeStack()
    const dlq = new Queue(stack, 'DLQ')
    const topic = new Topic(stack, 'AlarmTopic')

    new DlqAlarm(stack, 'Alarm', { dlq, alarmName: 'test-dlq-alarm', alarmTopic: topic })

    Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'ApproximateNumberOfMessagesVisible',
      Threshold: 0,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1
    })
  })

  it('treats missing data as not-breaching', () => {
    const stack = makeStack()
    const dlq = new Queue(stack, 'DLQ')
    const topic = new Topic(stack, 'AlarmTopic')

    new DlqAlarm(stack, 'Alarm', { dlq, alarmName: 'test-dlq-alarm', alarmTopic: topic })

    Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
      TreatMissingData: 'notBreaching'
    })
  })

  it('wires the SNS topic as an alarm action', () => {
    const stack = makeStack()
    const dlq = new Queue(stack, 'DLQ')
    const topic = new Topic(stack, 'AlarmTopic')

    new DlqAlarm(stack, 'Alarm', { dlq, alarmName: 'test-dlq-alarm', alarmTopic: topic })

    const template = Template.fromStack(stack)
    const alarms = template.findResources('AWS::CloudWatch::Alarm')
    const alarm = Object.values(alarms)[0] as any
    expect(alarm.Properties.AlarmActions).toHaveLength(1)
    expect(alarm.Properties.AlarmActions[0].Ref).toMatch(/^AlarmTopic/)
  })

  it('overrides the alarm logical ID when alarmLogicalId is provided', () => {
    const stack = makeStack()
    const dlq = new Queue(stack, 'DLQ')
    const topic = new Topic(stack, 'AlarmTopic')

    new DlqAlarm(stack, 'Alarm', {
      dlq,
      alarmName: 'test-dlq-alarm',
      alarmTopic: topic,
      alarmLogicalId: 'MyCustomAlarmId'
    })

    expect(Template.fromStack(stack).findResources('AWS::CloudWatch::Alarm')).toHaveProperty(
      'MyCustomAlarmId'
    )
  })
})
