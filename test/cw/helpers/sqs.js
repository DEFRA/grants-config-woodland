import {
  ListQueuesCommand,
  PurgeQueueCommand,
  SendMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { env } from 'node:process'
import { info } from './progress.js'

// fg-cw-backend runs against LocalStack (compose maps it to :4567). The CW
// create-new-case queue is a plain FIFO queue the app polls directly — the
// event is the raw SQS message body (no SNS Notification wrapper to unwrap).
const sqs = new SQSClient({
  region: env.AWS_REGION || 'eu-west-2',
  endpoint: env.AWS_ENDPOINT_URL || 'http://localhost:4567',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
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

// Send a case.create CloudEvent to the FIFO queue the app consumes. groupId
// keeps a fixture's events ordered; a random one per fixture avoids cross-fixture
// head-of-line blocking.
export const sendMessage = async (queueUrl, message, groupId) =>
  sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: groupId || randomUUID()
    })
  )

export const purgeQueue = async (queueUrl) =>
  sqs.send(new PurgeQueueCommand({ QueueUrl: queueUrl })).catch(() => {})

export const purgeQueues = async (queueUrls) =>
  Promise.all(queueUrls.map((url) => purgeQueue(url)))
