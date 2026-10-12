// Suite C — the GAS front door agrees with its downstream consumers: every answer those
// services read is declared (at full depth) in the GAS schema, unconditionally-read
// answers are required, and shared codes/roles match.
//
// Boundary: relative item-field refs ("@.field" under an itemsRef/rowsRef) are not
// resolved. Every current one (landParcels[].*, payments.agreement[].*) is fully declared,
// so none are missed; the absolute "$.…" paths surface the real gaps.

import { schemeDirs, loadScheme } from './helpers/load.js'
import {
  gasQuestions,
  gasRequired,
  gasConditionalRequired,
  jsonataAnswerPaths,
  resolveAnswerPath
} from './helpers/extract.js'
import { schemeContract } from './contract.config.js'

const unresolved = (questions, paths) =>
  [...paths].filter((path) => !resolveAnswerPath(questions, path).ok).sort()

describe('Suite C — GAS ⇔ downstream services', () => {
  for (const scheme of schemeDirs()) {
    const { gas, agreement, payment, cw, ui } = loadScheme(scheme)
    const contract = schemeContract[scheme] ?? {}
    const questions = gasQuestions(gas)

    describe(scheme, () => {
      it('C1: agreement.json answer references all resolve in the GAS schema', () => {
        const paths = jsonataAnswerPaths(agreement, [
          '$.application.',
          '$.agreement.application.'
        ])
        const missing = unresolved(questions, paths)
        expect(
          missing,
          `agreement.json reads answer paths GAS does not declare: ${missing.join(', ')}`
        ).toEqual([])
      })

      it('C2: cw.json answer references all resolve in the GAS schema', () => {
        const paths = jsonataAnswerPaths(cw, ['$.payload.answers.'])
        const missing = unresolved(questions, paths)
        expect(
          missing,
          `cw.json reads answer paths GAS does not declare: ${missing.join(', ')}`
        ).toEqual([])
      })

      it('C3: gas.json self-references all resolve in the GAS schema', () => {
        const paths = jsonataAnswerPaths(gas, ['$.answers.'])
        const missing = unresolved(questions, paths)
        expect(
          missing,
          `gas.json renders answer paths it does not declare: ${missing.join(', ')}`
        ).toEqual([])
      })

      it('C4: answers read unconditionally by downstream are GAS-required', () => {
        const optional = new Set(contract.optionalAnswerFields ?? [])
        const required = new Set([
          ...gasRequired(gas),
          ...gasConditionalRequired(gas)
        ])
        const topLevelReads = new Set(
          [
            ...jsonataAnswerPaths(agreement, [
              '$.application.',
              '$.agreement.application.'
            ]),
            ...jsonataAnswerPaths(cw, ['$.payload.answers.']),
            ...jsonataAnswerPaths(gas, ['$.answers.'])
          ].map((path) => path.split('.')[0])
        )
        const notRequired = [...topLevelReads]
          .filter((field) => !optional.has(field) && !required.has(field))
          .sort()
        expect(
          notRequired,
          `downstream reads these answers but GAS does not require them: ${notRequired.join(', ')}`
        ).toEqual([])
      })

      it('C5: scheme and capital-item codes match across configs', () => {
        const { prefix, capitalItem } = contract

        // Capital item (e.g. PA3)
        expect(gas.entitlementTemplates?.[0]?.fields?.actionCode?.value).toBe(
          capitalItem
        )
        for (const paymentGroup of payment.payments ?? []) {
          for (const line of paymentGroup.invoiceLines ?? []) {
            expect(line.schemeCode).toBe(capitalItem)
          }
        }

        // Scheme prefix (e.g. WMP)
        expect(agreement.agreementNumberPrefix).toBe(prefix)
        expect(agreement.create?.values?.schemeCode).toBe(prefix)
        expect(payment.scheme).toBe(prefix)
        expect(payment.sourceSystem).toBe(prefix)
        expect(ui.metadata?.referenceNumberPrefix).toBe(prefix)
      })

      it('C6: casework roles are a subset of the GAS claim roles', () => {
        const gasRoles = new Set([
          ...(gas.claims?.requiredRoles?.allOf ?? []),
          ...(gas.claims?.requiredRoles?.anyOf ?? [])
        ])
        for (const role of cw.requiredRoles?.allOf ?? []) {
          expect(
            gasRoles.has(role),
            `cw.json requires role "${role}" that GAS claims config does not grant`
          ).toBe(true)
        }
      })
    })
  }
})
