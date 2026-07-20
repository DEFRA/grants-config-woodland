import { env } from 'node:process'
import { makeSqsHelpers } from '../../helpers/sqs.js'

// fg-cw-backend consumes case.create CloudEvents from a plain FIFO queue it
// polls directly (the event is the raw SQS message body — no SNS Notification
// wrapper to unwrap), so the shared SQS helpers cover everything this suite
// needs. LocalStack SQS on :4567; the fallback is load-bearing for globalSetup
// (see test/helpers/sqs.js). sendMessage sends the event.
const { ensureQueues, purgeQueues, sendMessage } = makeSqsHelpers(
  env.AWS_ENDPOINT_URL || 'http://localhost:4567'
)

export { ensureQueues, purgeQueues, sendMessage }
