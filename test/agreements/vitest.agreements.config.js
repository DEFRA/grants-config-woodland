/// <reference types="vitest/config" />
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')

// The agreements compose.yml hard-codes host ports (floci :4566, mongo :27017,
// app :3555), so the harness talks to those directly. Nothing else should be
// occupying them while the suite runs.
const FLOCI = 'http://localhost:4566'
const SQS_URL = `${FLOCI}/000000000000`

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: projectRoot,
    include: ['test/agreements/**/*.test.js'],
    globalSetup: resolve(here, 'setup.js'),
    setupFiles: [resolve(here, 'matchers.js')],
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 240000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      AWS_REGION: 'eu-west-2',
      AWS_ENDPOINT_URL: FLOCI,
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      MONGO_URI:
        'mongodb://localhost:27017/farming-grants-agreements-api?directConnection=true',
      MONGO_DATABASE: 'farming-grants-agreements-api',
      APP_HEALTH_URL: 'http://localhost:3555/health',
      // Queue the app consumes create-agreement events from.
      CREATE_AGREEMENT_QUEUE_URL: `${SQS_URL}/create_agreement_fifo.fifo`,
      // floci subscribes this SQS queue to the agreement_status_updated SNS
      // topic the app publishes to (see compose/start-floci.sh).
      AGREEMENT_STATUS_QUEUE_URL: `${SQS_URL}/agreement_status_updated_fifo.fifo`,
      // App container logs are streamed here so rejected-case tests can assert
      // the WMP validation error (ingestion is async — no HTTP response).
      APP_LOG_FILE: resolve(here, '.tmp/agreements-app.log'),
      PRINT_LOGS: process.env.PRINT_LOGS
    }
  }
})
