import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))
}

const schema = loadJson('configurations/woodland/schemas/woodland-application.schema.json')

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
  landParcels: [{ parcelId: 'parcel-1', areaHa: 1.5 }]
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
    expect(validate({ ...VALID_APPLICATION, hectaresTenOrOverYearsOld: 0.1 })).toBe(false)
  })

  test('totalHectaresForSelectedParcels must be >= 0.5', () => {
    expect(validate({ ...VALID_APPLICATION, totalHectaresForSelectedParcels: 0.4 })).toBe(false)
  })

  test('fcTeamCode must be one of the allowed values', () => {
    expect(validate({ ...VALID_APPLICATION, fcTeamCode: 'UNKNOWN_REGION' })).toBe(false)
  })

  test('landParcel areaHa must be > 0', () => {
    expect(validate({ ...VALID_APPLICATION, landParcels: [{ parcelId: 'p1', areaHa: 0 }] })).toBe(false)
  })
})

