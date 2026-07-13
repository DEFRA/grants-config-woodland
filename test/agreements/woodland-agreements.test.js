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
import { buildCreateAgreementEvent } from './event.js'
import { step, info, ok } from './helpers/progress.js'
import { gasAcceptedFixtures, loadFixture } from '../pipeline/fixtures.js'

const CODE = 'woodland'
const CREATE_QUEUE = env.CREATE_AGREEMENT_QUEUE_URL
const STATUS_QUEUE = env.AGREEMENT_STATUS_QUEUE_URL

// The cross-service invariant: every application GAS accepts must be accepted by
// agreements. GAS forwards the answers verbatim, so a rejection here is a
// stuck-in-production incident. We therefore drive ONLY the GAS-accepted
// fixtures through agreements and require each to be accepted; a rejection fails
// the build with a contract-violation message. GAS-rejected fixtures never reach
// agreements in production and are not exercised here.
info(
  `GAS-accepted fixture(s) to verify downstream: ${gasAcceptedFixtures.join(', ')}`
)

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

describe('every GAS-accepted application is accepted by agreements', () => {
  it('there is at least one GAS-accepted fixture to verify', () => {
    expect(
      gasAcceptedFixtures.length,
      'no GAS-accepted fixtures — the downstream invariant would be vacuous'
    ).toBeGreaterThan(0)
  })

  it.each(gasAcceptedFixtures)('%s', async (file) => {
    step(`Fixture '${file}' — GAS accepts it, so agreements must accept it too`)
    const answers = loadFixture(file)
    const { clientRef, event } = buildCreateAgreementEvent(answers)
    info(`clientRef=${clientRef}`)

    await sendEvent(CREATE_QUEUE, event, clientRef)
    info('Event sent; waiting for the WMP handler to process it…')

    const violation = `CONTRACT VIOLATION: GAS accepts '${file}' but agreements rejected it — every GAS-accepted application must be accepted by every downstream service`

    const version = await waitForVersion(clientRef, 20000)
    expect(version, violation).toBeTruthy()
    expect(version.status, violation).toBe('offered')
    ok(`Fixture '${file}' — agreement version created (status 'offered')`)

    await expect(STATUS_QUEUE).toHaveReceived({
      id: expect.any(String),
      source: expect.any(String),
      specversion: '1.0',
      type: expect.any(String),
      time: expect.any(String),
      datacontenttype: 'application/json',
      data: {
        agreementNumber: expect.stringMatching(/^WMP\d/),
        correlationId: expect.any(String),
        clientRef,
        status: 'offered',
        date: expect.anything(),
        code: CODE,
        scheme: expect.any(String)
      }
    })
    ok(`Fixture '${file}' — agreement_status_updated event received`)
  })
})
