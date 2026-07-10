import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as path from 'node:path'
import { styleText } from 'node:util'
import { DockerComposeEnvironment, Wait } from 'testcontainers'
import { ensureQueues } from './helpers/sqs.js'

// Boots farming-grants-agreements-api with floci (SQS/SNS/S3) + replica-set
// MongoDB from a local checkout. No published image exists, so the app is built
// from source. Override the checkout with AGREEMENTS_REPO_PATH.
const defaultRepo = path.resolve(
  import.meta.dirname,
  '../../../farming-grants-agreements-api'
)

const SERVICE = 'farming-grants-agreements-api'

let environment

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig
  const repoPath = process.env.AGREEMENTS_REPO_PATH || defaultRepo

  environment = await new DockerComposeEnvironment(repoPath, 'compose.yml')
    .withProfiles('full') // the app service is gated behind this profile
    .withBuild()
    .withEnvironment({ SEED_DB: 'false' })
    // Wait strategies are keyed by the parsed container name (<service>-1), not
    // the bare service name. floci publishes 4510-4559 but only listens on 4566,
    // so the default host-port wait hangs — use its compose healthcheck instead.
    .withWaitStrategy('floci-1', Wait.forHealthCheck())
    .withWaitStrategy('mongodb-1', Wait.forHealthCheck())
    .withWaitStrategy(`${SERVICE}-1`, Wait.forHttp('/health', 3555))
    .withStartupTimeout(240000)
    // Lists the services whose wait strategies apply; the init jobs start
    // automatically as depends_on of the app.
    .up(['floci', 'mongodb', SERVICE])

  // Queues the harness sends to / reads from must exist before tests run.
  await ensureQueues([
    env.CREATE_AGREEMENT_QUEUE_URL,
    env.AGREEMENT_STATUS_QUEUE_URL
  ])

  // Stream app logs to a file so rejected-case tests can assert the WMP
  // validation error (event ingestion is async — there's no HTTP response).
  mkdirSync(dirname(env.APP_LOG_FILE), { recursive: true })
  const logFile = createWriteStream(env.APP_LOG_FILE, { flags: 'w' })
  const appContainer = environment.getContainer(`${SERVICE}-1`)
  const logStream = await appContainer.logs()
  logStream.on('data', (line) => {
    logFile.write(line)
    if (env.PRINT_LOGS) {
      process.stdout.write(styleText('gray', line))
    }
  })
}

export const teardown = async () => {
  await environment?.down()
}
