import { randomUUID } from 'node:crypto'

// The test-data/*.json files are raw application answers. GAS expects the
// application request envelope defined by
// fg-gas-backend/src/grants/schemas/requests/submit-application-request.schema.js:
//   { metadata: { clientRef, sbi, frn, crn, submittedAt?, ...unknown }, answers }
// GAS validates `answers` against the grant's questions schema; the identifiers
// in `metadata` are transport concerns and are not schema-validated.
export const wrapAnswers = (answers) => {
  const clientRef = `cr-woodland-${randomUUID()}`
  const sbi = answers?.applicant?.business?.sbi ?? '1234567890'

  return {
    clientRef,
    envelope: {
      metadata: {
        clientRef,
        submittedAt: new Date().toISOString(),
        sbi: String(sbi),
        frn: '1234567890',
        crn: '1234567890'
      },
      answers
    }
  }
}
