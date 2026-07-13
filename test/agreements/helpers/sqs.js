import {
  DeleteMessageCommand,
  ListQueuesCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { env } from 'node:process'
import { info } from './progress.js'

// floci is LocalStack-compatible on :4566.
const sqs = new SQSClient({
  region: env.AWS_REGION || 'eu-west-2',
  endpoint: env.AWS_ENDPOINT_URL || 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
})

const getQueueNames = (queueUrls) =>
  queueUrls.map((url) => url.split('/000000000000/').at(-1))

export const ensureQueues = async (queueUrls, attempt = 1) => {
  const maxRetries = 30
  const retryDelay = 3000
  const queues = getQueueNames(queueUrls)

  const data = await sqs.send(new ListQueuesCommand({ MaxResults: 1000 }))
  const found = getQueueNames(data.QueueUrls || [])

  const missing = queues.filter((name) => !found.includes(name))
  if (missing.length === 0) {
    return
  }

  if (attempt === maxRetries) {
    throw new Error(`SQS queues not available after ${maxRetries} attempts`)
  }

  info(
    `SQS not ready (attempt ${attempt}/${maxRetries}); still waiting for: ${missing.join(', ')}`
  )
  await delay(retryDelay)
  return ensureQueues(queueUrls, attempt + 1)
}

// Send a create-agreement CloudEvent to the FIFO queue the app consumes. The
// queue has ContentBasedDeduplication, so no explicit dedup id is needed.
export const sendEvent = async (queueUrl, event, groupId) =>
  sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
      MessageGroupId: groupId || randomUUID()
    })
  )

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

export const purgeQueues = async (queueUrls) =>
  Promise.all(
    queueUrls.map((url) =>
      sqs.send(new PurgeQueueCommand({ QueueUrl: url })).catch(() => {})
    )
  )
