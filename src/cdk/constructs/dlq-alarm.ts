import { Construct } from 'constructs'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { ITopic } from 'aws-cdk-lib/aws-sns'

export interface DlqAlarmProps {
  dlq: Queue
  alarmName: string
  alarmTopic: ITopic
}

export class DlqAlarm extends Construct {
  public readonly alarm: Alarm

  constructor(scope: Construct, id: string, props: DlqAlarmProps) {
    super(scope, id)

    this.alarm = new Alarm(this, `${id}Alarm`, {
      alarmName: props.alarmName,
      metric: props.dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 0,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING
    })

    this.alarm.addAlarmAction(new SnsAction(props.alarmTopic))
  }
}
