import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import './matchers.js'
import { purgeQueues, sendEvent } from './helpers/sqs.js'
import {
  clearAgreementData,
  closeMongo,
  findVersionByClientRef
} from './helpers/mongo.js'
import { logMark, waitForLog } from './helpers/logs.js'
import { buildCreateAgreementEvent } from './event.js'
import { step, info, ok } from './helpers/progress.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CODE = 'woodland'
const CREATE_QUEUE = env.CREATE_AGREEMENT_QUEUE_URL
const STATUS_QUEUE = env.AGREEMENT_STATUS_QUEUE_URL

const loadJson = (relPath) =>
  JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))

const expectations = loadJson('test/agreements/expectations.json')
const testDataDir = resolve(root, 'configurations/woodland/gas/test-data')
const fixtures = readdirSync(testDataDir).filter(
  (f) => f.endsWith('.json') && f !== 'generated-random.json'
)

info(`Discovered ${fixtures.length} fixture(s): ${fixtures.join(', ')}`)

// Poll for the agreement version the WMP handler creates (ingestion is async).
const waitForVersion = async (clientRef, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  do {
    const version = await findVersionByClientRef(clientRef)
    if (version) return version
    await delay(250)
  } while (Date.now() < deadline)
  return null
}

beforeEach(async () => {
  await clearAgreementData()
  await purgeQueues([CREATE_QUEUE, STATUS_QUEUE])
})

afterAll(async () => {
  await closeMongo()
})

describe('woodland test-data sent to agreements as create-agreement events', () => {
  it('has an expectation for every fixture', () => {
    for (const file of fixtures) {
      expect(expectations, `missing expectation for ${file}`).toHaveProperty(
        file
      )
    }
  })

  it.each(fixtures)('%s', async (file) => {
    const expected = expectations[file]
    step(
      `Fixture '${file}' — sending create-agreement event (expecting ${expected.accepted ? 'agreement version created' : 'rejection in app log'})`
    )
    const answers = loadJson(`configurations/woodland/gas/test-data/${file}`)
    const { clientRef, event } = buildCreateAgreementEvent(answers)
    info(`clientRef=${clientRef}`)

    const mark = logMark()
    await sendEvent(CREATE_QUEUE, event, clientRef)
    info('Event sent; waiting for the WMP handler to process it…')

    if (expected.accepted) {
      const version = await waitForVersion(clientRef, 20000)
      expect(
        version,
        'expected an agreement version to be created'
      ).toBeTruthy()
      expect(version.status).toBe('offered')
      ok(`Fixture '${file}' — agreement version created (status 'offered')`)

      await expect(STATUS_QUEUE).toHaveReceived({
        id: expect.any(String),
        source: expect.any(String),
        specversion: '1.0',
        type: expect.any(String),
        time: expect.any(String),
        datacontenttype: 'application/json',
        data: {
          agreementNumber: expect.stringMatching(/^WMP-/),
          correlationId: expect.any(String),
          clientRef,
          status: 'offered',
          date: expect.anything(),
          code: CODE,
          scheme: expect.any(String)
        }
      })
      ok(`Fixture '${file}' — agreement_status_updated event received`)
    } else {
      // The handler logs "Invalid WMP create-agreement payload: ..." on
      // rejection — the strong signal that the event was received and refused.
      info(`Waiting for rejection in app log: "${expected.errorContains}"`)
      const logged = await waitForLog(expected.errorContains, mark, 20000)
      expect(
        logged,
        `expected app log to contain "${expected.errorContains}"`
      ).toBe(true)

      // And no agreement/version should have been persisted.
      const version = await findVersionByClientRef(clientRef)
      expect(version, 'expected no agreement version to be created').toBeNull()
      ok(`Fixture '${file}' — rejected as expected (no version persisted)`)
    }
  })
})
