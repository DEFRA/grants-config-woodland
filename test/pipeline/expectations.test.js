import { describe, expect, test } from 'vitest'
import { expectations, fixtures } from './fixtures.js'

// Docker-free guard for the pipeline source of truth. It does not exercise any
// service — it only keeps expectations.json well-formed and in lock-step with
// the fixtures on disk, so the GAS and downstream suites have a trustworthy
// verdict for every fixture.
describe('pipeline expectations are well-formed', () => {
  const declared = Object.keys(expectations).filter((k) => k !== '_comment')

  test('every fixture has exactly one expectations entry', () => {
    for (const file of fixtures) {
      expect(expectations, `missing expectation for ${file}`).toHaveProperty(
        file
      )
    }
  })

  test('no expectation refers to a missing fixture', () => {
    for (const file of declared) {
      expect(fixtures, `expectation for unknown fixture ${file}`).toContain(
        file
      )
    }
  })

  test.each(declared)('%s has a valid GAS verdict', (file) => {
    const entry = expectations[file]
    expect(['accept', 'reject'], `${file}.gas`).toContain(entry.gas)
    if (entry.gas === 'reject') {
      expect(
        typeof entry.errorContains,
        `${file} is a reject and must declare errorContains`
      ).toBe('string')
      expect(entry.errorContains.length).toBeGreaterThan(0)
    }
  })
})
