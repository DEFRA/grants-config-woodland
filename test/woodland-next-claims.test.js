import { readFileSync } from 'node:fs'

const load = (service) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../configurations/woodland/${service}/${service}.next.json`,
        import.meta.url
      ),
      'utf8'
    )
  )

const gas = load('gas')
const cw = load('cw')
const fcReview =
  'PHASE_PRE_AWARD:STAGE_FC_REVIEWING:STATUS_APPLICATION_AWAITING_FC'
const preparing = 'PHASE_CLAIM:STAGE_PREPARE_CLAIM:STATUS_PREPARING_CLAIM'
const awaiting = 'PHASE_CLAIM:STAGE_AWAITING_CLAIM:STATUS_AWAITING_CLAIM'

const stageAt = (definition, position) => {
  const [phase, stage] = position.split(':')
  return definition.phases
    .find((item) => item.code === phase)
    .stages.find((item) => item.code === stage)
}

const statusAt = (definition, position) =>
  stageAt(definition, position).statuses.find(
    (item) => item.code === position.split(':')[2]
  )

const mappedPosition = (current, event) =>
  stageAt(gas.externalStatusMap, current).statuses.find(
    (item) => item.source === 'CW' && item.code === event
  ).mappedTo

describe('Woodland next claim preparation', () => {
  test('FC approval leaves both services preparing a claim that is not yet claimable', () => {
    const approval = statusAt(cw, fcReview).transitions.find(
      (item) => item.action.code === 'ACTION_FC_APPROVE_PLAN'
    )
    expect(approval.targetPosition).toBe(preparing)
    expect(mappedPosition(fcReview, approval.targetPosition)).toBe(preparing)
    expect(statusAt(gas, preparing).validFrom).toContainEqual({
      code: fcReview,
      processes: []
    })

    const entitlement = gas.entitlementTemplates[0]
    const position = {
      phase: 'PHASE_CLAIM',
      stage: 'STAGE_PREPARE_CLAIM',
      status: 'STATUS_PREPARING_CLAIM'
    }
    expect(entitlement.availableAt).toContainEqual(position)
    expect(entitlement.claim.claimableAt).not.toContainEqual(position)
  })

  test('completing the preparation tasks moves both services to a claimable position', () => {
    const completion = statusAt(cw, preparing).transitions.find(
      (item) => item.action.code === 'ACTION_CLAIM_PREP_COMPLETE'
    )
    expect(completion.checkTasks).toBe(true)
    expect(completion.targetPosition).toBe(awaiting)
    expect(mappedPosition(preparing, completion.targetPosition)).toBe(awaiting)
    expect(statusAt(gas, awaiting).validFrom).toContainEqual({
      code: preparing,
      processes: []
    })
    expect(gas.entitlementTemplates[0].claim.claimableAt).toEqual([
      {
        phase: 'PHASE_CLAIM',
        stage: 'STAGE_AWAITING_CLAIM',
        status: 'STATUS_AWAITING_CLAIM'
      }
    ])
  })
})
