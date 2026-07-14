import * as path from 'node:path'
import { styleText } from 'node:util'
import { DockerComposeEnvironment, Wait } from 'testcontainers'
import { ensureQueues } from './helpers/sqs.js'
import { step, info, ok } from './helpers/progress.js'

// Boots fg-cw-backend with LocalStack (SQS) + replica-set MongoDB + Entra stub
// from the self-contained compose files vendored in ./compose. No published image
// exists, so the app is built directly from the public repo's `main` via a Docker
// remote git context (see ./compose/compose.yml) — no local fg-cw-backend
// checkout is required.
const composeDir = path.join(import.meta.dirname, 'compose')

const SERVICE = 'fg-cw-backend'

let environment

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig

  step(
    'Booting cw stack (fg-cw-backend + MongoDB + LocalStack + Entra stub) — this can take a while on first build…'
  )
  info('Building fg-cw-backend image from github.com/DEFRA/fg-cw-backend#main')

  environment = await new DockerComposeEnvironment(composeDir, 'compose.yml')
    .withBuild()
    // compose.yml maps host ports from these vars; keep them off the gas phase's
    // ports so a full pipeline run never collides.
    .withEnvironment({
      CW_PORT: String(env.CW_PORT),
      MONGO_PORT: String(env.MONGO_PORT),
      LOCALSTACK_PORT: String(env.LOCALSTACK_PORT),
      ENTRA_PORT: String(env.ENTRA_PORT)
    })
    .withWaitStrategy(
      `${SERVICE}-1`,
      Wait.forHttp('/health', Number(env.CW_PORT))
    )
    .withStartupTimeout(240000)
    .up()

  ok(`fg-cw-backend is up and healthy (/health on :${env.CW_PORT})`)

  // The queue the harness sends case.create events to must exist before tests.
  step('Waiting for LocalStack SQS queues to be provisioned…')
  await ensureQueues([env.CW__SQS__CREATE_NEW_CASE_URL])
  ok('SQS queue ready')

  if (env.PRINT_LOGS) {
    try {
      const appContainer = environment.getContainer(`${SERVICE}-1`)
      const logStream = await appContainer.logs()
      logStream.on('data', (line) =>
        process.stdout.write(styleText('gray', line.toString()))
      )
      info('Streaming fg-cw-backend logs')
    } catch {
      // logs are best-effort
    }
  }

  step('Starting test run')
}

export const teardown = async () => {
  step('Tearing down cw stack…')
  await environment?.down()
  ok('cw stack stopped')
}
