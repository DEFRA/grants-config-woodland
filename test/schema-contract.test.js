import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))
}

const schema = loadJson(
  'configurations/woodland/gas/woodland-application.schema.json'
)

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)

// Minimal valid application fixture — extend as the schema evolves
const VALID_APPLICATION = {
  businessDetailsUpToDate: true,
  guidanceRead: true,
  landRegisteredWithRpa: true,
  landManagementControl: true,
  publicBodyTenant: false,
  landHasGrazingRights: false,
  appLandHasExistingWmp: false,
  intendToApplyHigherTier: false,
  includedAllEligibleWoodland: true,
  woodlandName: 'Test Wood',
  totalHectaresForSelectedParcels: 1.5,
  hectaresTenOrOverYearsOld: 0.4,
  hectaresUnderTenYearsOld: 0.5,
  centreGridReference: 'SU123456',
  fcTeamCode: 'SOUTH_WEST',
  applicationConfirmation: true,
  landParcels: [{ parcelId: 'parcel-1', areaHa: 1.5 }],
  // applicant / payments / totalAgreementPaymentPence are required so GAS gates
  // everything the downstream agreements service requires (no cross-service gap).
  applicant: {
    business: { name: 'Test Farm Ltd' },
    customer: { name: { first: 'Test', last: 'Applicant' } }
  },
  totalAgreementPaymentPence: 70000,
  payments: {
    agreement: [
      {
        code: 'WD2',
        description: 'Woodland management plan',
        activePaymentTier: 1,
        quantityInActiveTier: 1,
        activeTierRatePence: 70000,
        activeTierFlatRatePence: 0,
        quantity: 1,
        agreementTotalPence: 70000,
        unit: 'ha'
      }
    ]
  }
}

// ─── Contract tests ───────────────────────────────────────────────────────────
// Add a test for every inter-service constraint disagreement found.
// The shared schema is the authority; all services must respect it.

describe('woodland application schema contract', () => {
  test('valid application passes validation', () => {
    const valid = validate(VALID_APPLICATION)
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true)
  })

  test('landParcels must have at least one item', () => {
    expect(validate({ ...VALID_APPLICATION, landParcels: [] })).toBe(false)
  })

  test('hectaresTenOrOverYearsOld must be >= 0.4', () => {
    expect(
      validate({ ...VALID_APPLICATION, hectaresTenOrOverYearsOld: 0.1 })
    ).toBe(false)
  })

  test('totalHectaresForSelectedParcels must be >= 0.5', () => {
    expect(
      validate({ ...VALID_APPLICATION, totalHectaresForSelectedParcels: 0.4 })
    ).toBe(false)
  })

  test('fcTeamCode must be one of the allowed values', () => {
    expect(
      validate({ ...VALID_APPLICATION, fcTeamCode: 'UNKNOWN_REGION' })
    ).toBe(false)
  })

  test('landParcel areaHa must be > 0', () => {
    expect(
      validate({
        ...VALID_APPLICATION,
        landParcels: [{ parcelId: 'p1', areaHa: 0 }]
      })
    ).toBe(false)
  })

  test('totalAgreementPaymentPence must be an integer (pence)', () => {
    expect(
      validate({ ...VALID_APPLICATION, totalAgreementPaymentPence: 1.5 })
    ).toBe(false)
  })

  test('applicant.customer requires a name.{first,last}', () => {
    expect(
      validate({
        ...VALID_APPLICATION,
        applicant: {
          business: { name: 'Acme Farms Ltd' },
          customer: {}
        }
      })
    ).toBe(false)
  })

  test('applicant.business requires a name', () => {
    expect(
      validate({
        ...VALID_APPLICATION,
        applicant: {
          business: {},
          customer: { name: { first: 'Ada', last: 'Lovelace' } }
        }
      })
    ).toBe(false)
  })
})

// ─── Fixture validation ───────────────────────────────────────────────────────
// Every file in test-data/ must be a valid application, except:
//  - generated-random.json: fuzzing output, not a curated example.
//  - decimal-numeric-values.json: deliberate negative — non-integer pence, which
//    the shared schema rejects (GAS rejects it too, see test/pipeline).
//  - missing-required-fields.json: deliberate negative — omits the now-required
//    applicant / payments / totalAgreementPaymentPence, so GAS gates everything
//    the downstream agreements service needs.
// This catches accidental schema drift in the curated examples.

const SCHEMA_INVALID_FIXTURES = new Set([
  'generated-random.json',
  'decimal-numeric-values.json',
  'missing-required-fields.json'
])

const testDataDir = resolve(root, 'configurations/woodland/gas/test-data')

describe('test-data fixtures all conform to schema', () => {
  let files
  try {
    files = readdirSync(testDataDir).filter(
      (f) => f.endsWith('.json') && !SCHEMA_INVALID_FIXTURES.has(f)
    )
  } catch {
    files = []
  }

  test('at least one fixture file exists', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  test.each(files)('%s is valid', (file) => {
    const fixture = loadJson(`configurations/woodland/gas/test-data/${file}`)
    const valid = validate(fixture)
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true)
  })

  test('decimal-numeric-values.json is rejected (non-integer pence)', () => {
    const fixture = loadJson(
      'configurations/woodland/gas/test-data/decimal-numeric-values.json'
    )
    expect(validate(fixture)).toBe(false)
  })

  test('missing-required-fields.json is rejected (missing applicant/payments/total)', () => {
    const fixture = loadJson(
      'configurations/woodland/gas/test-data/missing-required-fields.json'
    )
    expect(validate(fixture)).toBe(false)
  })
})

// ─── Downstream-required fields are gated by GAS ───────────────────────────────
// applicant, payments and totalAgreementPaymentPence are required downstream
// (agreements), and GAS forwards answers verbatim — so the shared schema must
// require them too, or GAS would accept applications agreements rejects.
describe('shared schema requires the downstream-required fields', () => {
  test.each(['applicant', 'payments', 'totalAgreementPaymentPence'])(
    'omitting %s is rejected',
    (field) => {
      const fixture = { ...VALID_APPLICATION }
      delete fixture[field]
      expect(validate(fixture)).toBe(false)
    }
  )
})
