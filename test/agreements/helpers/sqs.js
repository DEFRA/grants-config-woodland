import {
  DeleteMessageCommand,
  ReceiveMessageCommand
} from '@aws-sdk/client-sqs'
import { env } from 'node:process'
import { makeSqsHelpers } from '../../helpers/sqs.js'

// floci is LocalStack-compatible on :4566. The fallback is load-bearing for
// globalSetup (see test/helpers/sqs.js). sendEvent is the shared sendMessage
// under the name this suite uses.
const { sqs, ensureQueues, purgeQueues, sendMessage } = makeSqsHelpers(
  env.AWS_ENDPOINT_URL || 'http://localhost:4566'
)

export { ensureQueues, purgeQueues }
export { sendMessage as sendEvent }

// Reads messages, unwrapping the SNS Notification envelope that floci adds when
// a message arrives via an SNS topic → SQS subscription.
//
// Each read message is deleted immediately. The app publishes every
// agreement_status_updated event with the same FIFO MessageGroupId (its
// serviceName), so an un-deleted, in-flight message blocks the whole group and
// starves later fixtures of their events (floci's PurgeQueue does not evict
// in-flight FIFO messages). Deleting on read — as a real consumer would — keeps
// the group unblocked between tests.
export const receiveMessages = async (queueUrl) => {
  const data = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 2
    })
  )

  if (!data.Messages) {
    return []
  }

  await Promise.all(
    data.Messages.map((message) =>
      sqs
        .send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          })
        )
        .catch(() => {})
    )
  )

  return data.Messages.map((message) => {
    const body = JSON.parse(message.Body)
    return body?.Type === 'Notification' && body.Message
      ? JSON.parse(body.Message)
      : body
  })
}
