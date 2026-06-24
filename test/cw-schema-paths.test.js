import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))
}

function extractAnswerPaths(obj, found = new Set()) {
  if (typeof obj === 'string') {
    const match = obj.match(/^\$\.payload\.answers\.(.+)$/)
    if (match) found.add(match[1])
    return found
  }
  if (Array.isArray(obj)) obj.forEach((v) => extractAnswerPaths(v, found))
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => extractAnswerPaths(v, found))
  return found
}

function resolveSchemaPath(schemaNode, dotPath) {
  const segments = dotPath.split('.')
  let node = schemaNode
  for (const seg of segments) {
    const key = seg.replace(/\[\d+\]$/, '')
    if (node.properties?.[key]) {
      node = node.properties[key]
      if (node.type === 'array' && node.items) node = node.items
    } else {
      return undefined
    }
  }
  return node
}

const schema = loadJson('configurations/woodland/schemas/woodland-application.schema.json')

describe('cw.json answer path references', () => {
  const cw = loadJson('configurations/woodland/cw/cw.json')
  const paths = [...extractAnswerPaths(cw)]

  test('at least one $.payload.answers path is found', () => {
    expect(paths.length).toBeGreaterThan(0)
  })

  test.each(paths)('$.payload.answers.%s exists in application schema', (path) => {
    expect(resolveSchemaPath(schema, path), `"${path}" not found in woodland-application.schema.json`).toBeDefined()
  })
})
