import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import './matchers.js'
import { postGrant, putGrant, submitApplication } from './helpers/http.js'
import { purgeQueue } from './helpers/sqs.js'
import { wrapAnswers } from './envelope.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CODE = 'woodland'
const CREATED_QUEUE = env.GAS__SQS__GRANT_APPLICATION_CREATED_QUEUE_URL

const loadJson = (relPath) =>
  JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))

const expectations = loadJson('test/gas/expectations.json')
const testDataDir = resolve(root, 'configurations/woodland/gas/test-data')

const fixtures = readdirSync(testDataDir).filter(
  (f) => f.endsWith('.json') && f !== 'generated-random.json'
)

// The status GAS assigns a freshly created application: first phase:stage:status
// of the grant config (Grant.getInitialState in fg-gas-backend).
const initialStatus = (config) => {
  const phase = config.phases[0]
  const stage = phase.stages[0]
  const status = stage.statuses[0]
  return `${phase.code}:${stage.code}:${status.code}`
}

let expectedStatus

beforeAll(async () => {
  // Build the config so the questions $ref to woodland-application.schema.json is
  // inlined — GAS cannot resolve the relative ref.
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
  const builtConfig = loadJson('dist/configurations/woodland/gas/gas.json')
  expectedStatus = initialStatus(builtConfig)

  // Upload the config. On a re-run against a persisted Mongo volume the grant
  // already exists (409) — replace it so we always test the latest config.
  const created = await postGrant(builtConfig)
  if (created.status === 409) {
    const replaced = await putGrant(CODE, builtConfig)
    expect(replaced.status, JSON.stringify(replaced.body)).toBe(204)
  } else {
    expect(created.status, JSON.stringify(created.body)).toBe(204)
  }
}, 180000)

describe('woodland test-data submitted to GAS', () => {
  it('has an expectation for every fixture', () => {
    for (const file of fixtures) {
      expect(expectations, `missing expectation for ${file}`).toHaveProperty(
        file
      )
    }
  })

  it.each(fixtures)('%s', async (file) => {
    await purgeQueue(CREATED_QUEUE)

    const expected = expectations[file]
    const answers = loadJson(`configurations/woodland/gas/test-data/${file}`)
    const { clientRef, envelope } = wrapAnswers(answers)

    const { status, body } = await submitApplication(CODE, envelope)

    if (expected.accepted) {
      expect(status, JSON.stringify(body)).toBe(204)

      await expect(CREATED_QUEUE).toHaveReceived({
        id: expect.any(String),
        time: expect.any(String),
        source: 'fg-gas-backend',
        specversion: '1.0',
        type: 'cloud.defra.local.fg-gas-backend.application.created',
        datacontenttype: 'application/json',
        traceparent: expect.anything(),
        data: {
          clientRef,
          code: CODE,
          status: expectedStatus
        },
        messageGroupId: `${clientRef}-${CODE}`
      })
    } else {
      expect(status, JSON.stringify(body)).toBe(400)
      if (expected.errorContains) {
        expect(JSON.stringify(body)).toContain(expected.errorContains)
      }
    }
  })
})
