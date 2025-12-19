import crypto from 'crypto'
import { pool } from './db'

const getSecretKey = () => {
  const secret = process.env.KEY_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('Missing KEY_ENCRYPTION_SECRET in environment')
  }
  // Derive 32-byte key from secret (AES-256) and return as Uint8Array
  const hash = crypto.createHash('sha256').update(secret).digest()
  return new Uint8Array(hash)
}

const encryptPrivateKey = (privateKey: string) => {
  const key = getSecretKey()
  const iv = new Uint8Array(crypto.randomBytes(12))
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat(
    [cipher.update(privateKey, 'utf8'), cipher.final()] as unknown as Uint8Array[]
  )
  const tag = cipher.getAuthTag()

  return {
    ciphertext: enc.toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    tag: tag.toString('base64'),
  }
}

const decryptPrivateKey = (ciphertext: string, iv: string, tag: string): string => {
  const key = getSecretKey()
  const ivBuf = new Uint8Array(Buffer.from(iv, 'base64'))
  const tagBuf = new Uint8Array(Buffer.from(tag, 'base64'))
  const encBuf = new Uint8Array(Buffer.from(ciphertext, 'base64'))

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf)
  decipher.setAuthTag(tagBuf)
  const dec = Buffer.concat(
    [decipher.update(encBuf), decipher.final()] as unknown as Uint8Array[]
  )
  return dec.toString('utf8')
}

export const saveKeyPair = async (params: {
  label: string
  publicKey: string
  privateKey: string
}) => {
  const { label, publicKey, privateKey } = params
  const { ciphertext, iv, tag } = encryptPrivateKey(privateKey)

  const conn = await pool.getConnection()
  try {
    // Optional: deactivate previous active keys with same label
    await conn.execute(
      `UPDATE encryption_keys SET is_active = 0 WHERE label = ? AND is_active = 1`,
      [label]
    )

    await conn.execute(
      `INSERT INTO encryption_keys
        (label, public_key, private_key_ciphertext, iv_base64, tag_base64, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, NOW(), 1)`,
      [label, publicKey, ciphertext, iv, tag]
    )
  } finally {
    conn.release()
  }
}

export const getActiveKeyPair = async (label: string) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.execute(
      `SELECT public_key, private_key_ciphertext, iv_base64, tag_base64
       FROM encryption_keys
       WHERE label = ? AND is_active = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [label]
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      return null
    }

    const row: any = rows[0]

    // Private key fields may be empty if only the public key is stored.
    let privateKey: string | null = null
    const hasEncryptedPrivate =
      row.private_key_ciphertext && row.iv_base64 && row.tag_base64

    if (hasEncryptedPrivate) {
      try {
        privateKey = decryptPrivateKey(
          String(row.private_key_ciphertext),
          String(row.iv_base64),
          String(row.tag_base64)
        )
      } catch (error) {
        console.error('Failed to decrypt stored private key:', error)
        privateKey = null
      }
    }

    return {
      publicKey: String(row.public_key),
      privateKey,
    }
  } finally {
    conn.release()
  }
}


