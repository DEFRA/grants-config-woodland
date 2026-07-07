import {
  ListQueuesCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs'
import { setTimeout as delay } from 'node:timers/promises'
import { env } from 'node:process'

// Mirrors fg-gas-backend/test/helpers/sqs.js — the LocalStack SQS client and
// the queue-readiness / receive / purge helpers used by the integration tests.
const sqs = new SQSClient({
  region: env.AWS_REGION || 'eu-west-2',
  endpoint: env.AWS_ENDPOINT_URL || 'http://localhost:4599',
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

  if (queues.every((name) => found.includes(name))) {
    return
  }

  if (attempt === maxRetries) {
    throw new Error(`SQS queues not available after ${maxRetries} attempts`)
  }

  await delay(retryDelay)
  return ensureQueues(queueUrls, attempt + 1)
}

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

export const purgeQueue = async (queueUrl) =>
  sqs.send(new PurgeQueueCommand({ QueueUrl: queueUrl }))

export const purgeQueues = async (queueUrls) =>
  Promise.all(queueUrls.map((url) => purgeQueue(url)))
