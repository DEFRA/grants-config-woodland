import { randomUUID } from 'node:crypto'
import { env } from 'node:process'

// Thin client over global fetch (Node 24). Adds the seeded bearer token and a
// tracing header. Returns { status, body } — body is parsed JSON when present,
// otherwise the raw text (GAS returns 204 with an empty body on success).
const TEST_TOKEN = '00000000-0000-0000-0000-000000000000'

const request = async (method, path, payload, headers = {}) => {
  const res = await fetch(`${env.API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TEST_TOKEN}`,
      'x-cdp-request-id': headers['x-cdp-request-id'] ?? randomUUID(),
      ...headers
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  })

  const text = await res.text()
  let body = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // leave body as raw text
  }

  return { status: res.status, body }
}

export const postGrant = (config) => request('POST', '/grants', config)

// Replace endpoint currently lives under /tmp in fg-gas-backend.
export const putGrant = (code, config) =>
  request('PUT', `/tmp/grants/${code}`, config)

export const submitApplication = (code, envelope, traceId) =>
  request('POST', `/grants/${code}/applications`, envelope, {
    'x-cdp-request-id': traceId
  })
