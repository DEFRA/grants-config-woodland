import { MongoClient } from 'mongodb'
import { env } from 'node:process'

// Single shared client for the whole suite (connected lazily).
let clientPromise

const getDb = async () => {
  if (!clientPromise) {
    clientPromise = new MongoClient(env.MONGO_URI).connect()
  }
  const client = await clientPromise
  return client.db(env.MONGO_DATABASE)
}

export const findVersionByClientRef = async (clientRef) => {
  const db = await getDb()
  return db.collection('versions').findOne({ clientRef })
}

// Wipe the agreement collections so each fixture starts from a clean slate.
export const clearAgreementData = async () => {
  const db = await getDb()
  await Promise.all(
    ['agreements', 'grants', 'versions'].map((c) =>
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
