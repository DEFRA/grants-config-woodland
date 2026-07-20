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

// Build the SQS helpers bound to a client for the given endpoint.
//
// Each suite passes its own endpoint fallback rather than relying purely on
// AWS_ENDPOINT_URL: the queue-readiness check runs in vitest's globalSetup,
// where the config's `test.env` is NOT applied to process.env, so only the
// hard-coded fallback points globalSetup at the right LocalStack/floci instance.
export const makeSqsHelpers = (endpoint) => {
  const sqs = new SQSClient({
    region: env.AWS_REGION || 'eu-west-2',
    endpoint,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
  })

  const getQueueNames = (queueUrls) =>
    queueUrls.map((url) => url.split('/000000000000/').at(-1))

  // Poll ListQueues until every expected queue exists (the compose stacks create
  // them asynchronously on boot), or give up after maxRetries.
  const ensureQueues = async (queueUrls, attempt = 1) => {
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

  // Send a CloudEvent to a FIFO queue the app consumes. A random MessageGroupId
  // per fixture keeps that fixture's events ordered while avoiding cross-fixture
  // head-of-line blocking. Queues use ContentBasedDeduplication, so no explicit
  // dedup id is needed.
  const sendMessage = async (queueUrl, message, groupId) =>
    sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: groupId || randomUUID()
      })
    )

  const purgeQueue = async (queueUrl) =>
    sqs.send(new PurgeQueueCommand({ QueueUrl: queueUrl })).catch(() => {})

  const purgeQueues = async (queueUrls) =>
    Promise.all(queueUrls.map((url) => purgeQueue(url)))

  return { sqs, ensureQueues, sendMessage, purgeQueue, purgeQueues }
}
