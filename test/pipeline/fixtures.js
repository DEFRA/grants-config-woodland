import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Shared source of truth for the cross-service pipeline suites.
//
// The invariant every suite enforces: an application GAS accepts must be
// accepted by every downstream service (agreements today, more later) — because
// GAS forwards the answers verbatim, a downstream rejection of a GAS-accepted
// application is a stuck-in-production incident.
//
// `expectations.json` declares ONLY each fixture's GAS verdict. The rule
// "GAS-accept => every downstream accepts" lives in the suites, not the data, so
// a gap cannot be declared away: the GAS suite proves the accept-list is
// truthful, and each downstream suite proves it accepts every GAS-accepted
// fixture.
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const testDataDir = resolve(root, 'configurations/woodland/gas/test-data')

export const expectations = JSON.parse(
  readFileSync(resolve(here, 'expectations.json'), 'utf8')
)

// generated-random.json is fuzzing output, not a curated pipeline fixture.
export const fixtures = readdirSync(testDataDir).filter(
  (f) => f.endsWith('.json') && f !== 'generated-random.json'
)

export const loadFixture = (file) =>
  JSON.parse(readFileSync(resolve(testDataDir, file), 'utf8'))

export const gasVerdict = (file) => expectations[file]?.gas

// The fixtures a downstream service must accept (the invariant's left-hand side).
export const gasAcceptedFixtures = fixtures.filter(
  (f) => expectations[f]?.gas === 'accept'
)
