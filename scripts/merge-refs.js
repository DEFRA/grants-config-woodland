import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function resolveRefs(obj, basePath) {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map((item) => resolveRefs(item, basePath))

  if ('$ref' in obj && typeof obj['$ref'] === 'string' && !obj['$ref'].startsWith('#')) {
    const refPath = resolve(dirname(basePath), obj['$ref'])
    const refContent = JSON.parse(readFileSync(refPath, 'utf8'))
    const { $ref, ...siblings } = obj
    return resolveRefs({ ...refContent, ...siblings }, refPath)
  }

  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveRefs(v, basePath)]))
}

const configs = ['configurations/woodland/gas/gas.json']

for (const configPath of configs) {
  const abs = resolve(rootDir, configPath)
  const config = JSON.parse(readFileSync(abs, 'utf8'))
  const resolved = resolveRefs(config, abs)

  const outPath = resolve(rootDir, 'dist', configPath)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(resolved, null, 2))
  console.log(`${configPath} → dist/${configPath}`)
}
