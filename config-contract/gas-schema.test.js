// Suite A — the GAS front-door schema is itself a valid validator.

import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { schemeDirs, loadScheme } from './helpers/load.js'
import {
  gasQuestions,
  gasProperties,
  topLevelField
} from './helpers/extract.js'
import { schemeContract } from './contract.config.js'

describe('Suite A — GAS front-door schema validity', () => {
  for (const scheme of schemeDirs()) {
    const { gas } = loadScheme(scheme)
    const contract = schemeContract[scheme] ?? {}

    describe(scheme, () => {
      it('A1: gas.json code matches the scheme directory', () => {
        expect(gas.code).toBe(scheme)
        expect(gas.code).toBe(contract.code)
      })

      it('A2: every phase questions block compiles as JSON Schema 2020-12', () => {
        for (const phase of gas.phases) {
          const ajv = new Ajv2020({ strict: false, allErrors: true })
          addFormats(ajv)
          expect(
            () => ajv.compile(phase.questions),
            `phase ${phase.code} questions should compile`
          ).not.toThrow()
        }
      })

      it('A3: fgSum* keywords reference declared properties', () => {
        const questions = gasQuestions(gas)
        const properties = gasProperties(gas)
        for (const keyword of ['fgSumMax', 'fgSumMin', 'fgSumEquals']) {
          const group = questions[keyword]
          if (!group) continue
          for (const field of group.fields ?? []) {
            expect(
              properties.has(topLevelField(field)),
              `${keyword}.fields references unknown property "${field}"`
            ).toBe(true)
          }
          if (group.targetField) {
            expect(
              properties.has(topLevelField(group.targetField)),
              `${keyword}.targetField references unknown property "${group.targetField}"`
            ).toBe(true)
          }
        }
      })
    })
  }
})
