import { MongoClient } from 'mongodb'
import { env } from 'node:process'

// Single client per suite process, connected lazily and shared across calls.
let clientPromise

// Resolve the database. When `dbName` is omitted the database encoded in
// MONGO_URI (e.g. …/fg-cw-backend) is used; suites whose URI omits it pass an
// explicit name.
export const getDb = async (dbName) => {
  if (!clientPromise) {
    clientPromise = new MongoClient(env.MONGO_URI).connect()
  }
  const client = await clientPromise
  return client.db(dbName)
}

// Delete every document from the given collections so each fixture starts from a
// clean slate.
export const clearCollections = async (collections, dbName) => {
  const db = await getDb(dbName)
  await Promise.all(
    collections.map((c) => db.collection(c).deleteMany({}))
  )
}

export const closeMongo = async () => {
  if (clientPromise) {
    const client = await clientPromise
    await client.close().catch(() => {})
    clientPromise = undefined
  }
}
