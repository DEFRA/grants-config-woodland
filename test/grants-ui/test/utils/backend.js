import { getAuthorizationHeader } from './backend-auth.js'

const BASE_URL = process.env.BASE_BACKEND_URL

/**
 * Clears all test data (application state, submissions, and locks) for a
 * given SBI under the given grant, across every grant version, before a
 * test run.
 *
 * @param {string} sbi
 * @param {string} grantCode
 */
export async function clearApplicationData(sbi, grantCode) {
  const response = await fetch(
    `${BASE_URL}/admin/test-data?sbi=${sbi}&grantCode=${grantCode}`,
    { method: 'DELETE', headers: { Authorization: getAuthorizationHeader() } }
  )
  if (response.status !== 200) {
    throw new Error(`Failed to clear test data: ${response.status}`)
  }
}
