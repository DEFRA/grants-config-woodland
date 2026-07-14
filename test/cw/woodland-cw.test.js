import { env } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { purgeQueues, sendMessage } from './helpers/sqs.js'
import {
  clearCaseData,
  closeMongo,
  findCaseByCaseRef
} from './helpers/mongo.js'
import { createAdminUser, loadWoodlandWorkflow } from './helpers/cw-api.js'
import { buildCreateCaseEvent } from './event.js'
import { step, info, ok } from './helpers/progress.js'
import { gasAcceptedFixtures, loadFixture } from '../pipeline/fixtures.js'

const CREATE_QUEUE = env.CW__SQS__CREATE_NEW_CASE_URL

// The woodland CW workflow's initial position (configurations/woodland/cw/cw.json).
const INITIAL = {
  currentPhase: 'PHASE_PRE_AWARD',
  currentStage: 'STAGE_REVIEWING_APPLICATION',
  currentStatus: 'STATUS_APPLICATION_RECEIVED'
}

// The cross-service invariant: every application GAS accepts must be accepted by
// case-working. GAS forwards the answers verbatim as a case.create event, so a
// case that never appears is a stuck-in-production incident. We therefore drive
// ONLY the GAS-accepted fixtures through fg-cw-backend and require each to create
// a case; a miss fails the build with a contract-violation message. GAS-rejected
// fixtures never reach case-working in production and are not exercised here.
info(
  `GAS-accepted fixture(s) to verify downstream: ${gasAcceptedFixtures.join(', ')}`
)

// Poll for the case the inbox subscriber creates (processing is async).
const waitForCase = async (caseRef, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  do {
    const kase = await findCaseByCaseRef(caseRef)
    if (kase) return kase
    await delay(250)
  } while (Date.now() < deadline)
  return null
}

beforeAll(async () => {
  // Case creation resolves the workflow by code and needs an admin to seed it.
  await createAdminUser()
  await loadWoodlandWorkflow()
})

beforeEach(async () => {
  await clearCaseData()
  await purgeQueues([CREATE_QUEUE])
})

afterAll(async () => {
  await closeMongo()
})

describe('every GAS-accepted application is accepted by case-working', () => {
  it('there is at least one GAS-accepted fixture to verify', () => {
    expect(
      gasAcceptedFixtures.length,
      'no GAS-accepted fixtures — the downstream invariant would be vacuous'
    ).toBeGreaterThan(0)
  })

  it.each(gasAcceptedFixtures)('%s', async (file) => {
    step(
      `Fixture '${file}' — GAS accepts it, so case-working must create a case`
    )
    const answers = loadFixture(file)
    const { caseRef, event } = buildCreateCaseEvent(answers)
    info(`caseRef=${caseRef}`)

    await sendMessage(CREATE_QUEUE, event, caseRef)
    info('Event sent; waiting for the inbox subscriber to create the case…')

    const violation = `CONTRACT VIOLATION: GAS accepts '${file}' but fg-cw-backend did not create a case — every GAS-accepted application must be accepted by every downstream service`

    const kase = await waitForCase(caseRef, 20000)
    expect(kase, violation).toBeTruthy()
    expect(kase.workflowCode, violation).toBe('woodland')
    expect(
      {
        currentPhase: kase.currentPhase,
        currentStage: kase.currentStage,
        currentStatus: kase.currentStatus
      },
      violation
    ).toEqual(INITIAL)
    ok(
      `Fixture '${file}' — case created at ${INITIAL.currentPhase}:${INITIAL.currentStage}:${INITIAL.currentStatus}`
    )
  })
})
