import { getDb, clearCollections } from '../../helpers/mongo.js'

// The database name is carried in MONGO_URI (…/fg-cw-backend), so getDb() with
// no argument resolves it. Client lifecycle is shared; see test/helpers/mongo.js.
export { closeMongo } from '../../helpers/mongo.js'

export const findCaseByCaseRef = async (caseRef) => {
  const db = await getDb()
  return db.collection('cases').findOne({ caseRef })
}

// Wipe the case-working collections so each fixture starts from a clean slate.
// (The workflow and users seeded in beforeAll live in other collections.)
export const clearCaseData = () =>
  clearCollections(['cases', 'case_series', 'inbox', 'outbox'])
