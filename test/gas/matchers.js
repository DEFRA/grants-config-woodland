import { expect, vi } from 'vitest'
import { receiveMessages } from './helpers/sqs.js'

// Polls an SQS queue until a message deep-equals the expected shape (supports
// asymmetric matchers like expect.any(String)). Mirrors fg-gas-backend's matcher.
expect.extend({
  async toHaveReceived(queueUrl, expectedMessage) {
    let messages = []
    const pass = await vi
      .waitUntil(
        async () => {
          messages = messages.concat(await receiveMessages(queueUrl))
          return messages.some((msg) => this.equals(msg, expectedMessage))
        },
        { timeout: 15000, interval: 250 }
      )
      .then(() => true)
      .catch(() => false)

    return {
      pass,
      actual: messages,
      expected: [expectedMessage],
      message: () =>
        pass
          ? `Expected queue ${queueUrl} not to have received the message`
          : `Expected queue ${queueUrl} to have received a matching message`
    }
  }
})
