import crypto from 'crypto'

const IV_LENGTH_BYTES = 12
const KEY_LENGTH_BYTES = 32
const SCRYPT_SALT = 'salt'
const CIPHER_ALGORITHM = 'aes-256-gcm'

export function getAuthorizationHeader() {
  const token = process.env.GRANTS_UI_BACKEND_AUTH_TOKEN
  const encryptionKey = process.env.GRANTS_UI_BACKEND_ENCRYPTION_KEY

  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const key = crypto.scryptSync(encryptionKey, SCRYPT_SALT, KEY_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv)

  let encrypted = cipher.update(token, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()
  const encryptedToken = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`

  return `Bearer ${Buffer.from(encryptedToken).toString('base64')}`
}
