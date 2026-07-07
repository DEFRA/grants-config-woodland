import { MongoClient } from 'mongodb'

// Seed the access_tokens collection so bearer auth passes for the harness.
// Token: 00000000-0000-0000-0000-000000000000 → SHA-256 hash below.
// Mirrors fg-gas-backend/test/auth-setup.js.
export const TEST_TOKEN = '00000000-0000-0000-0000-000000000000'
const HASHED_TOKEN =
  '12b9377cbe7e5c94e8a70d9d23929523d14afa954793130f8a3959c7b849aca8'

async function seedAccessToken() {
  const uri = process.env.MONGO_URI
  if (!uri) return

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const col = client.db().collection('access_tokens')
    await col.updateOne(
      { id: HASHED_TOKEN },
      { $set: { id: HASHED_TOKEN, client: 'test' } },
      { upsert: true }
    )
  } catch (err) {
    console.warn('[auth-setup] Failed to seed access_tokens:', err?.message)
  } finally {
    await client.close().catch(() => {})
  }
}

await seedAccessToken()
