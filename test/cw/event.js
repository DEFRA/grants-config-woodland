import { randomUUID } from 'node:crypto'

// fg-cw-backend ingests a "case.create" CloudEvent — the one GAS emits from
// CreateNewCaseCommand when it accepts an application
// (fg-gas-backend/src/grants/commands/create-new-case.command.js). The inbox
// subscriber keys off the "case.create" suffix of `type`.
const EVENT_TYPE = 'cloud.defra.local.fg-gas-backend.case.create'

// Build the event for a woodland test-data file. STRICT VERBATIM: `answers` is
// the fixture unchanged. Only the envelope, `workflowCode` and the transport
// `identifiers` are synthesised — the same derivation the GAS/agreements harness
// uses. `workflowCode` is the grant code, which routes to the woodland workflow.
export const buildCreateCaseEvent = (answers) => {
  const caseRef = `cw-woodland-${randomUUID()}`
  const sbi = String(answers?.applicant?.business?.sbi ?? '1234567890')
  const now = new Date().toISOString()

  return {
    caseRef,
    event: {
      id: randomUUID(),
      time: now,
      source: 'fg-gas-backend',
      specversion: '1.0',
      type: EVENT_TYPE,
      datacontenttype: 'application/json',
      data: {
        caseRef,
        workflowCode: 'woodland',
        payload: {
          createdAt: now,
          submittedAt: now,
          identifiers: {
            sbi,
            crn: '1234567890',
            frn: '1234567890',
            defraId: '1234567890'
          },
          metadata: {},
          answers
        }
      }
    }
  }
}
