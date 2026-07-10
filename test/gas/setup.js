import { copyFileSync, existsSync } from 'node:fs'
import * as path from 'node:path'
import { styleText } from 'node:util'
import { DockerComposeEnvironment, Wait } from 'testcontainers'
import { ensureQueues } from './helpers/sqs.js'
import { step, info, ok } from './helpers/progress.js'

// Boots the real GAS stack (gas + replica-set MongoDB + LocalStack SNS/SQS)
// from a local fg-gas-backend checkout. There is no published GAS image, so the
// harness builds it from source. Override the checkout location with GAS_REPO_PATH.
const defaultGasRepo = path.resolve(
  import.meta.dirname,
  '../../../fg-gas-backend'
)

let environment

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig
  const gasRepoPath = process.env.GAS_REPO_PATH || defaultGasRepo

  step(
    'Booting GAS stack (gas + MongoDB + LocalStack) — this can take a while on first build…'
  )
  info(`GAS repo: ${gasRepoPath}`)
  info(
    `Ports — gas:${env.GAS_PORT} mongo:${env.MONGO_PORT} localstack:${env.LOCALSTACK_PORT}`
  )

  // The gas service's compose declares `env_file: .env`. A fresh checkout may
  // not have one (it's normally created by GAS's own `npm install`), so seed it
  // from .env.example to keep the harness self-contained.
  const gasEnv = path.join(gasRepoPath, '.env')
  const gasEnvExample = path.join(gasRepoPath, '.env.example')
  if (!existsSync(gasEnv) && existsSync(gasEnvExample)) {
    copyFileSync(gasEnvExample, gasEnv)
  }

  environment = await new DockerComposeEnvironment(gasRepoPath, 'compose.yml')
    .withBuild()
    .withEnvironment({
      GAS_PORT: env.GAS_PORT,
      MONGO_PORT: env.MONGO_PORT,
      LOCALSTACK_PORT: env.LOCALSTACK_PORT,
      OUTBOX_POLL_MS: env.OUTBOX_POLL_MS,
      INBOX_POLL_MS: env.INBOX_POLL_MS
    })
    .withWaitStrategy('gas', Wait.forHttp('/health', 3102))
    .withNoRecreate()
    .up()

  ok(`GAS service is up and healthy (/health on :${env.GAS_PORT})`)

  // Wait until the FIFO queues provisioned by start-localstack.sh exist before
  // any test tries to read from them.
  step('Waiting for LocalStack SQS queues to be provisioned…')
  await ensureQueues([
    env.GAS__SQS__GRANT_APPLICATION_CREATED_QUEUE_URL,
    env.GAS__SQS__GRANT_APPLICATION_STATUS_UPDATED_QUEUE_URL,
    env.CW__SQS__CREATE_NEW_CASE_QUEUE_URL,
    env.GAS__SQS__UPDATE_STATUS_QUEUE_URL,
    env.CREATE_AGREEMENT_QUEUE_URL
  ])
  ok('All SQS queues ready')
  step('Starting test run')

  if (env.PRINT_LOGS) {
    const gasContainer = environment.getContainer('gas-1')
    const logStream = await gasContainer.logs()
    logStream.on('data', (line) =>
      process.stdout.write(styleText('gray', line))
    )
  }
}

export const teardown = async () => {
  step('Tearing down GAS stack…')
  await environment?.down()
  ok('GAS stack stopped')
}
