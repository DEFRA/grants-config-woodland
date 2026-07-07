/// <reference types="vitest/config" />
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')

// Ports on the host. Chosen to avoid clashing with a locally-running GAS stack
// (which defaults to 3102 / 27017 / 4566).
const GAS_PORT = 3199
const MONGO_PORT = 27099
const LOCALSTACK_PORT = 4599

const SQS_URL = `http://sqs.eu-west-2.127.0.0.1:${LOCALSTACK_PORT}/000000000000`

// Env values mirror fg-gas-backend/test/vitest.config.js so the mocked stack is
// wired identically (queue URLs / topic ARNs must match the names created by
// fg-gas-backend/compose/start-localstack.sh).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: projectRoot,
    include: ['test/gas/**/*.test.js'],
    globalSetup: resolve(here, 'setup.js'),
    setupFiles: [resolve(here, 'matchers.js'), resolve(here, 'auth-setup.js')],
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 180000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      GAS_PORT: String(GAS_PORT),
      MONGO_PORT: String(MONGO_PORT),
      LOCALSTACK_PORT: String(LOCALSTACK_PORT),
      API_URL: `http://localhost:${GAS_PORT}`,
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-gas-backend?directConnection=true`,
      AWS_REGION: 'eu-west-2',
      AWS_ENDPOINT_URL: `http://localhost:${LOCALSTACK_PORT}`,
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      // Speed up the outbox publisher so emitted events land quickly.
      OUTBOX_POLL_MS: '250',
      INBOX_POLL_MS: '250',
      GAS__SQS__GRANT_APPLICATION_CREATED_QUEUE_URL: `${SQS_URL}/gas__sqs__grant_application_created_fifo.fifo`,
      GAS__SQS__GRANT_APPLICATION_STATUS_UPDATED_QUEUE_URL: `${SQS_URL}/gas__sqs__application_status_updated_fifo.fifo`,
      CW__SQS__CREATE_NEW_CASE_QUEUE_URL: `${SQS_URL}/cw__sqs__create_new_case_fifo.fifo`,
      GAS__SQS__UPDATE_STATUS_QUEUE_URL: `${SQS_URL}/gas__sqs__update_status_fifo.fifo`,
      CREATE_AGREEMENT_QUEUE_URL: `${SQS_URL}/create_agreement_fifo.fifo`,
      PRINT_LOGS: process.env.PRINT_LOGS
    }
  }
})
