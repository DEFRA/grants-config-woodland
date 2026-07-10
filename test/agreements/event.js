import { randomUUID } from 'node:crypto'

// The agreements service ingests a "create agreement" CloudEvent (as produced by
// GAS's CreateAgreementCommand) and routes code:"woodland" to its WMP handler.
// The handler only acts when `type` contains "gas-backend.agreement.create".
const EVENT_TYPE = 'cloud.defra.local.fg-gas-backend.agreement.create'

// Build the event for a woodland test-data file. STRICT VERBATIM: `answers` is
// the fixture unchanged. Only the envelope and the top-level `identifiers`
// (transport concerns the WMP schema requires) are synthesised — the same
// identifier derivation the GAS harness uses.
export const buildCreateAgreementEvent = (answers) => {
  const clientRef = `agr-woodland-${randomUUID()}`
  const sbi = String(answers?.applicant?.business?.sbi ?? '1234567890')

  return {
    clientRef,
    event: {
      id: randomUUID(),
      source: 'fg-gas-backend',
      specversion: '1.0',
      type: EVENT_TYPE,
      datacontenttype: 'application/json',
      data: {
        clientRef,
        code: 'woodland',
        metadata: {},
        identifiers: {
          sbi,
          crn: '1234567890',
          frn: '1234567890',
          defraId: '1234567890'
        },
        answers
      }
    }
  }
}
