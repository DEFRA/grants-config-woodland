// Suite B — grants-ui agrees with the GAS front door: the UI can build exactly the
// payload GAS requires, with matching enums and statuses.

import { schemeDirs, loadScheme } from './helpers/load.js'
import {
  gasRequired,
  gasConditionalRequired,
  gasProperties,
  gasEnum,
  gasStatusCodes,
  uiAnswerFields,
  uiInputFieldNames,
  uiListValues,
  uiPageByPath,
  uiRedirectGasStatuses
} from './helpers/extract.js'
import { schemeContract } from './contract.config.js'

describe('Suite B — grants-ui ⇔ GAS', () => {
  for (const scheme of schemeDirs()) {
    const { gas, ui } = loadScheme(scheme)
    const contract = schemeContract[scheme] ?? {}

    describe(scheme, () => {
      it('is configured in contract.config.js', () => {
        expect(schemeContract[scheme]).toBeDefined()
      })

      it('B1: grants-ui grantCode matches gas.json code', () => {
        expect(ui.metadata?.submission?.grantCode).toBe(gas.code)
      })

      it('B2: every GAS-required answer is collectable by the UI', () => {
        const provided = new Set([
          ...uiAnswerFields(ui),
          ...(contract.derivedFields ?? [])
        ])
        for (const field of gasRequired(gas)) {
          expect(
            provided.has(field),
            `GAS requires "${field}" but grants-ui provides no component, hidden field, confirmation field or derived value`
          ).toBe(true)
        }
      })

      it('B3: conditionally-required answers are collected by a UI component', () => {
        const inputs = new Set(uiInputFieldNames(ui))
        for (const field of gasConditionalRequired(gas)) {
          expect(
            inputs.has(field),
            `conditionally-required "${field}" has no grants-ui input component`
          ).toBe(true)
        }
      })

      it('B4: every UI answer field (except gating fields) is a GAS property', () => {
        const properties = gasProperties(gas)
        const gating = new Set(contract.uiOnlyGatingFields ?? [])
        for (const field of uiAnswerFields(ui)) {
          if (gating.has(field)) continue
          expect(
            properties.has(field),
            `grants-ui collects "${field}" but GAS declares no such answer property`
          ).toBe(true)
        }
      })

      it('B5: FC team list values match the GAS fcTeamCode enum', () => {
        const uiValues = [
          ...uiListValues(ui, 'forestryCommissionTeamList')
        ].sort()
        const gasValues = [...(gasEnum(gas, 'fcTeamCode') ?? [])].sort()
        expect(uiValues).toEqual(gasValues)
      })

      it('B6: the minimum woodland area (0.5 ha) is consistent everywhere', () => {
        const questions = gas.phases.find(
          (p) => p.code === 'PHASE_PRE_AWARD'
        ).questions
        const entitlement = gas.entitlementTemplates?.[0]?.fields?.totalHectares
        const landParcelsPage = uiPageByPath(ui, '/land-parcels')

        const threshold = landParcelsPage?.config?.minimumAreaHa
        expect(threshold).toBe(questions.fgSumMin?.minimum)
        expect(threshold).toBe(
          questions.properties?.totalHectaresForSelectedParcels?.minimum
        )
        expect(threshold).toBe(entitlement?.minValue)
      })

      it('B7: every redirect GAS status exists in gas.json', () => {
        const defined = gasStatusCodes(gas)
        const stripped = new Set(
          [...defined].map((code) => code.replace(/^STATUS_/, ''))
        )
        for (const status of uiRedirectGasStatuses(ui)) {
          const known =
            defined.has(status) || stripped.has(status.replace(/^STATUS_/, ''))
          expect(
            known,
            `grants-ui redirects on GAS status "${status}" which gas.json does not define`
          ).toBe(true)
        }
      })
    })
  }
})
