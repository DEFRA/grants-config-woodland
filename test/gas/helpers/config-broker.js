import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

// Mocks the one config-broker behaviour the GAS suite depends on: attaching a
// version to a grant config before it reaches GAS.
//
// In production the config broker reads release.yml, derives each grant's
// version, and hands that version to GAS alongside the config. GAS stores the
// grant keyed on { code, version } and — critically — the application-submission
// path reads it back with findByCode(code, version = "0.0.0"), hard-defaulting
// to "0.0.0". This GAS suite has no config broker, so without this mock the
// upload would carry no version, land as version:null, and never be read by the
// app flow. See gas-grant-version-lookup memory.
//
// The version is NOT baked into gas.json: it belongs to the release, not the
// config. release.yml is the same source of truth run-all-tests.sh uses when it
// stages config under woodland@<version>.
const here = dirname(fileURLToPath(import.meta.url))
const releaseFile = resolve(here, '../../release.yml')

// release.yml is either a single flat release ({ name, version, ... }) or a
// { releases: [...] } list, matching the config broker's own two accepted
// shapes. Normalise to a list.
const readReleases = () => {
  const doc = parse(readFileSync(releaseFile, 'utf8'))
  return Array.isArray(doc?.releases) ? doc.releases : [doc]
}

// The version the config broker would publish for `code`.
export const releaseVersion = (code) => {
  const release = readReleases().find((r) => r?.name === code)
  if (!release?.version) {
    throw new Error(`No release version for grant '${code}' in ${releaseFile}`)
  }
  return release.version
}

// Apply the config broker's version to a built grant config, the way GAS would
// receive it in production.
export const withReleaseVersion = (config) => ({
  ...config,
  version: releaseVersion(config.code)
})
