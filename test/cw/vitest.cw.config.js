/// <reference types="vitest/config" />
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')

// fg-cw-backend's compose.yml maps host ports from CW_PORT/MONGO_PORT/
// LOCALSTACK_PORT/ENTRA_PORT. Reuse the CW test suite's own values so a full
// pipeline run never collides with the gas phase (3199/27099/4599).
const CW_PORT = 3101
const MONGO_PORT = 27018
const LOCALSTACK_PORT = 4567
const ENTRA_PORT = 3011

const SQS_URL = `http://sqs.eu-west-2.127.0.0.1:${LOCALSTACK_PORT}/000000000000`

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: projectRoot,
    include: ['test/cw/**/*.test.js'],
    globalSetup: resolve(here, 'setup.js'),
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 240000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      AWS_REGION: 'eu-west-2',
      AWS_ENDPOINT_URL: `http://localhost:${LOCALSTACK_PORT}`,
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      MONGO_URI: `mongodb://localhost:${MONGO_PORT}/fg-cw-backend?directConnection=true`,
      API_URL: `http://localhost:${CW_PORT}`,
      OIDC_SIGN_TOKEN_ENDPOINT: `http://localhost:${ENTRA_PORT}/sign`,
      // Queue the app consumes case.create events from.
      CW__SQS__CREATE_NEW_CASE_URL: `${SQS_URL}/cw__sqs__create_new_case_fifo.fifo`,
      // Passed through to the compose environment for host-port mapping.
      CW_PORT: String(CW_PORT),
      MONGO_PORT: String(MONGO_PORT),
      LOCALSTACK_PORT: String(LOCALSTACK_PORT),
      ENTRA_PORT: String(ENTRA_PORT),
      PRINT_LOGS: process.env.PRINT_LOGS
    }
  }
})
