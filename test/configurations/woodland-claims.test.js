import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
const load = async (name) =>
  JSON.parse(
    await readFile(
      new URL(`../../configurations/woodland/gas/${name}`, import.meta.url),
      'utf8'
    )
  )
describe('Woodland next claim delivery', () => {
  it('enables supplementary data delivery while retaining automatic completion', async () => {
    const next = await load('./gas.next.json')
    expect(next.claims.onClaimSubmission.processes).toEqual([
      'STORE_CLAIM_CASE'
    ])
    expect(next.entitlementTemplates[0].claim.requiresApproval).toBe(false)
    expect(next.claims.onClaimApproval).toEqual({
      currentPosition: {
        phase: 'PHASE_CLAIM',
        stage: 'STAGE_AWAITING_CLAIM',
        status: 'STATUS_AWAITING_CLAIM'
      },
      targetPosition: {
        phase: 'PHASE_CLAIM',
        stage: 'STAGE_CLAIM_COMPLETE',
        status: 'STATUS_CLAIM_COMPLETE'
      }
    })
    expect((await load('./gas.json')).claims?.onClaimSubmission).toBeUndefined()
  })
})
