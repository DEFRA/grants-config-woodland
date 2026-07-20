import { expect, vi } from 'vitest'

// Registers an async `toHaveReceived` matcher that polls an SQS queue (via the
// suite's own receiveMessages) until a message deep-equals the expected shape.
// Deep-equality goes through this.equals so asymmetric matchers like
// expect.any(String) are supported. `timeout` bounds how long to wait for the
// message to arrive.
export const registerToHaveReceived = (receiveMessages, { timeout } = {}) => {
  expect.extend({
    async toHaveReceived(queueUrl, expectedMessage) {
      let messages = []
      const pass = await vi
        .waitUntil(
          async () => {
            messages = messages.concat(await receiveMessages(queueUrl))
            return messages.some((msg) => this.equals(msg, expectedMessage))
          },
          { timeout, interval: 250 }
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
}
