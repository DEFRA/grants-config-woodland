import { ReceiveMessageCommand } from '@aws-sdk/client-sqs'
import { env } from 'node:process'
import { makeSqsHelpers } from '../../helpers/sqs.js'

// LocalStack SQS on :4599. The fallback is load-bearing for globalSetup — see
// test/helpers/sqs.js.
const { sqs, ensureQueues, purgeQueue, purgeQueues } = makeSqsHelpers(
  env.AWS_ENDPOINT_URL || 'http://localhost:4599'
)

export { ensureQueues, purgeQueue, purgeQueues }

// GAS emits plain JSON message bodies (no SNS Notification wrapper), so each
// received body is parsed directly.
export const receiveMessages = async (queueUrl) => {
  const data = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 5
    })
  )

  if (!data.Messages) {
    return []
  }

  return data.Messages.map((message) => JSON.parse(message.Body))
}
