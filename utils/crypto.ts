// Client-side vote encryption helpers (RSA-OAEP + AES-GCM hybrid)

export interface EncryptedVotePayload {
  ciphertext: string // base64
  iv: string // base64
  wrappedKey: string // base64 (AES key encrypted with RSA public key)
}

// Fetch the current election public key from backend (MySQL-backed)
export const fetchElectionPublicKey = async (
  label = 'default_election'
): Promise<string> => {
  const res = await fetch(`/api/crypto/public-key?label=${encodeURIComponent(label)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to load encryption public key')
  }
  const data = await res.json()
  return String(data.publicKey)
}

// Convert PEM string to ArrayBuffer for Web Crypto import
const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const clean = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/[\r\n]/g, '')
    .trim()

  const binary = atob(clean)
  const len = binary.length
  const buffer = new ArrayBuffer(len)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < len; i++) {
    view[i] = binary.charCodeAt(i)
  }
  return buffer
}

const getSubtle = (): SubtleCrypto => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment')
  }
  return window.crypto.subtle
}

// Encrypt arbitrary vote data (object) into ciphertext + wrapped AES key
export const encryptVoteClientSide = async (
  voteData: unknown,
  publicKeyPem: string
): Promise<EncryptedVotePayload> => {
  const subtle = getSubtle()

  // 1. Import RSA public key
  const publicKey = await subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  )

  // 2. Generate AES-GCM key
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  // 3. Serialize vote data to bytes
  const encodedVote = new TextEncoder().encode(JSON.stringify(voteData))

  // 4. Random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  // 5. Encrypt vote with AES-GCM
  const ciphertextBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encodedVote
  )

  // 6. Export AES key and wrap with RSA public key
  const rawAesKey = await subtle.exportKey('raw', aesKey)
  const wrappedKeyBuf = await subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey
  )

  // 7. Convert to base64 strings for storage/transmission
  const toBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  return {
    ciphertext: toBase64(ciphertextBuf),
    iv: toBase64(iv.buffer),
    wrappedKey: toBase64(wrappedKeyBuf),
  }
}


