import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const IGNORED_VIOLATIONS = [
  {
    description: 'Ensure all page content is contained by landmarks',
    ignoredTargets: [
      '.govuk-back-link',
      '.govuk-skip-link',
      '.govuk-width-container:nth-child(6)',
      '.govuk-width-container:nth-child(7)',
      '.govuk-width-container:nth-child(8)'
    ]
  }
]

export async function analyzeAccessibility(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()

  await test.info().attach('WCAG Analysis', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json'
  })

  const unexpectedViolations = extractUnexpectedViolations(results.violations)
  expect(unexpectedViolations).toEqual([])
}

function extractUnexpectedViolations(violations) {
  return violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter((node) => !isIgnoredNode(node, violation))
    }))
    .filter((violation) => violation.nodes.length > 0)
}

function isIgnoredNode(node, violation) {
  return IGNORED_VIOLATIONS.some(
    (ignored) =>
      ignored.description === violation.description &&
      ignored.ignoredTargets.some((target) => node.target[0] === target)
  )
}
