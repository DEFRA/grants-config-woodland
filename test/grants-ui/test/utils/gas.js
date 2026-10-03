import { mockServerClient } from 'mockserver-client'

function client() {
  return mockServerClient(
    process.env.MOCKSERVER_HOST,
    process.env.MOCKSERVER_PORT
  )
}

export async function clearExpectation(expectationId) {
  await client().clearById(expectationId)
}

export async function setDefaultStatusQuery404Response() {
  const expectationId = 'applications-status-404-override'
  await client().mockAnyResponse({
    id: expectationId,
    priority: 998,
    httpRequest: {
      method: 'GET',
      path: '/grants/.*/applications/.*/status'
    },
    httpResponse: {
      statusCode: 404
    }
  })
  return expectationId
}

export async function setStatusQueryResponse(referenceNumber, gasStatus) {
  const expectationId = `applications-${referenceNumber}-status-200`
  await client().mockAnyResponse({
    id: expectationId,
    priority: 999,
    httpRequest: {
      method: 'GET',
      path: `/grants/[^/]+/applications/${referenceNumber.toLowerCase()}/status`
    },
    httpResponse: {
      statusCode: 200,
      body: {
        type: 'JSON',
        json: {
          status: gasStatus
        }
      }
    }
  })
  return expectationId
}

export async function getApplicationSubmission(referenceNumber) {
  const requests = await client().retrieveRecordedRequests({
    path: '/grants/[^/]+/applications'
  })
  return requests.find(
    (r) => r.body.json.metadata.clientRef === referenceNumber.toLowerCase()
  )
}
