import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load as parseYaml } from 'js-yaml'

const here = dirname(fileURLToPath(import.meta.url))
export const configurationsDir = join(here, '..', '..', 'configurations')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readYaml = (path) => parseYaml(readFileSync(path, 'utf8'))

// Scheme directories that actually carry a GAS front-door schema.
export const schemeDirs = () =>
  readdirSync(configurationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      existsSync(join(configurationsDir, name, 'gas', 'gas.json'))
    )

// Load every config file that participates in the contract for one scheme.
export const loadScheme = (scheme) => {
  const root = join(configurationsDir, scheme)
  return {
    scheme,
    gas: readJson(join(root, 'gas', 'gas.json')),
    agreement: readJson(join(root, 'gas', 'agreement.json')),
    payment: readJson(join(root, 'gas', 'payment.json')),
    cw: readJson(join(root, 'cw', 'cw.json')),
    ui: readYaml(join(root, 'grants-ui', `${scheme}.yaml`))
  }
}
