import { MongoClient } from 'mongodb'
import { env } from 'node:process'

// Single shared client for the whole suite (connected lazily). The database name
// is carried in MONGO_URI (…/fg-cw-backend), so client.db() resolves it.
let clientPromise

const getDb = async () => {
  if (!clientPromise) {
    clientPromise = new MongoClient(env.MONGO_URI).connect()
  }
  const client = await clientPromise
  return client.db()
}

export const findCaseByCaseRef = async (caseRef) => {
  const db = await getDb()
  return db.collection('cases').findOne({ caseRef })
}

// Wipe the case-working collections so each fixture starts from a clean slate.
// (The workflow and users seeded in beforeAll live in other collections.)
export const clearCaseData = async () => {
  const db = await getDb()
  await Promise.all(
    ['cases', 'case_series', 'inbox', 'outbox'].map((c) =>
      db.collection(c).deleteMany({})
    )
  )
}

export const closeMongo = async () => {
  if (clientPromise) {
    const client = await clientPromise
    await client.close().catch(() => {})
    clientPromise = undefined
  }
}
