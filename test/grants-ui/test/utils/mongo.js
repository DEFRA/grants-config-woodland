import { MongoClient } from 'mongodb'

const STATE_COLLECTION = 'state__grant_application_state'
const MONGO_URI = process.env.MONGO_URI
const MONGO_DATABASE = 'grants-ui-backend'

let client

async function getDb() {
  if (!client) {
    client = new MongoClient(MONGO_URI)
    await client.connect()
  }
  return client.db(MONGO_DATABASE)
}

export const Mongo = {
  async getApplicationStatus(sbi, grantCode) {
    const db = await getDb()
    const document = await db
      .collection(STATE_COLLECTION)
      .findOne({ sbi, grantCode })

    if (!document) {
      throw new Error(
        `No application state found for SBI ${sbi}, grant ${grantCode}`
      )
    }

    return document.state.applicationStatus
  },

  async setApplicationStatus(sbi, grantCode, applicationStatus) {
    const db = await getDb()
    const result = await db.collection(STATE_COLLECTION).updateOne(
      { sbi, grantCode },
      {
        $set: { 'state.applicationStatus': applicationStatus },
        $currentDate: { updatedAt: true }
      }
    )

    if (result.matchedCount === 0) {
      throw new Error(
        `No application state found for SBI ${sbi}, grant ${grantCode} to set applicationStatus`
      )
    }
  }
}
