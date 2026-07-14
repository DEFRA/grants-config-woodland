import { MongoClient } from 'mongodb'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { env } from 'node:process'
import { info, ok } from './progress.js'

// Thin fetch-based client for the fg-cw-backend HTTP API, mirroring
// fg-cw-backend/test/helpers/{wreck,users,workflows}.js. Case creation happens
// over SQS (as "System", no auth), but seeding the workflow and admin user the
// case needs goes through the authenticated API, so we mint a token from the
// Entra stub the same way the CW integration tests do.
const here = dirname(fileURLToPath(import.meta.url))
const woodlandWorkflowPath = resolve(
  here,
  '../../../configurations/woodland/cw/cw.json'
)

const ADMIN = {
  idpId: '9f6b80d3-99d3-42dc-ac42-b184595b1ef1',
  name: 'Test Admin',
  email: 'admin@t.gov.uk',
  idpRoles: ['FCP.Casework.Admin', 'FCP.Casework.ReadWrite']
}

// App roles the woodland workflow references (requiredRoles.allOf: ["ROLE_WMP"]),
// granted with a wide validity window so authorisation never expires mid-run.
const APP_ROLES = {
  ROLE_WMP: { startDate: '2025-01-01', endDate: '2100-01-01' }
}

const getAdminToken = async () => {
  const res = await fetch(env.OIDC_SIGN_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'client1', username: ADMIN.email })
  })
  if (!res.ok) {
    throw new Error(`Entra stub sign failed: ${res.status} ${await res.text()}`)
  }
  const body = await res.json()
  return body.access_token
}

const api = async (method, path, token, payload) => {
  const res = await fetch(`${env.API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-cdp-request-id': randomUUID().replaceAll('-', '')
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text}`)
  }
  return text ? JSON.parse(text) : undefined
}

// Register the admin user, then force its app roles directly in Mongo (the API
// does not let an admin grant app roles to itself) — exactly as the CW test
// helper does.
export const createAdminUser = async () => {
  const token = await getAdminToken()
  const user = await api('POST', '/users/login', token, ADMIN)

  const client = new MongoClient(env.MONGO_URI)
  try {
    await client.connect()
    await client
      .db()
      .collection('users')
      .updateOne({ idpId: user.idpId }, { $set: { appRoles: APP_ROLES } })
  } finally {
    await client.close()
  }
  ok('Admin user seeded in fg-cw-backend')
}

// Load the production woodland case-working workflow. The config carries an
// extended-JSON `_id` ({ $oid }) for seeding scripts; the create-workflow route
// assigns its own id, so strip it before posting.
export const loadWoodlandWorkflow = async () => {
  const token = await getAdminToken()
  const workflow = JSON.parse(readFileSync(woodlandWorkflowPath, 'utf8'))
  delete workflow._id
  info(`Loading woodland workflow (code=${workflow.code})`)
  await api('POST', '/workflows', token, workflow)
  ok('Woodland workflow loaded')
}
