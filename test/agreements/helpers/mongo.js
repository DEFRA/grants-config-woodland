import { env } from 'node:process'
import { getDb, clearCollections } from '../../helpers/mongo.js'

// This suite's MONGO_URI omits the database, so the name comes from
// MONGO_DATABASE. Client lifecycle is shared; see test/helpers/mongo.js.
const DB = env.MONGO_DATABASE

export { closeMongo } from '../../helpers/mongo.js'

export const findVersionByClientRef = async (clientRef) => {
  const db = await getDb(DB)
  return db.collection('versions').findOne({ clientRef })
}

// Wipe the agreement collections so each fixture starts from a clean slate.
export const clearAgreementData = () =>
  clearCollections(['agreements', 'grants', 'versions'], DB)
