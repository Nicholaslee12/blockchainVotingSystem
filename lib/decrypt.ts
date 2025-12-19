// Backend vote decryption utilities (Node.js crypto)
import crypto from 'crypto'
import { getActiveKeyPair } from './keys'

// Convert PEM string to Buffer for Node.js crypto
const pemToBuffer = (pem: string): Buffer => {
  const clean = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/[\r\n]/g, '')
    .trim()

  return Buffer.from(clean, 'base64')
}

// Decrypt a single encrypted vote payload
export const decryptVote = async (
  payload: {
    ciphertext: string // base64
    iv: string // base64
    wrappedKey: string // base64
  },
  label = 'default_election'
): Promise<unknown> => {
  // 1. Get private key from MySQL
  const keyPair = await getActiveKeyPair(label)
  if (!keyPair || !keyPair.privateKey) {
    throw new Error(`No active key pair found for label: ${label}`)
  }

  const privateKeyPem = keyPair.privateKey

  // 2. Import RSA private key
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8',
  })

  // 3. Unwrap AES key (decrypt wrappedKey with RSA private key)
  const wrappedKeyBuf = Buffer.from(payload.wrappedKey, 'base64')
  const rawAesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    wrappedKeyBuf as unknown as NodeJS.ArrayBufferView
  )

  // 4. Decrypt ciphertext with AES-GCM
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')

  // Web Crypto's AES-GCM encrypt() appends the 16-byte auth tag at the end
  // Extract tag (last 16 bytes) and actual ciphertext (everything before)
  const tagLength = 16
  if (ciphertext.length < tagLength) {
    throw new Error('Ciphertext too short to contain authentication tag')
  }

  const actualCiphertext = ciphertext.slice(0, -tagLength)
  const tag = ciphertext.slice(-tagLength)

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    rawAesKey as unknown as crypto.CipherKey,
    iv as unknown as crypto.BinaryLike
  )
  decipher.setAuthTag(tag as unknown as NodeJS.ArrayBufferView)

  const updateResult = decipher.update(actualCiphertext as unknown as NodeJS.ArrayBufferView)
  const finalResult = decipher.final()
  const decrypted = Buffer.concat(
    [
      (typeof updateResult === 'string' ? Buffer.from(updateResult) : updateResult) as Buffer,
      (typeof finalResult === 'string' ? Buffer.from(finalResult) : finalResult) as Buffer,
    ] as unknown as Uint8Array[]
  )

  // 5. Parse JSON
  const voteData = JSON.parse(decrypted.toString('utf8'))
  return voteData
}

