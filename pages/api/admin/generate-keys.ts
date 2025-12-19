import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { saveKeyPair } from '@/lib/keys'
import { isAdmin } from '@/services/blockchain'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { adminAddress, label } = req.body || {}

  if (!adminAddress) {
    return res.status(400).json({ message: 'adminAddress is required' })
  }

  // Verify admin from blockchain
  try {
    const adminStatus = await isAdmin(String(adminAddress).toLowerCase())
    if (!adminStatus) {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' })
    }
  } catch (error) {
    console.error('Error verifying admin status:', error)
    return res.status(500).json({ message: 'Failed to verify admin status' })
  }

  try {
    // Generate RSA keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    })

    // Save to MySQL (private key will be encrypted automatically)
    await saveKeyPair({
      label: label || 'default_election',
      publicKey,
      privateKey,
    })

    return res.status(201).json({
      message: 'Key pair generated and saved successfully',
      label: label || 'default_election',
      publicKey, // Return public key for verification (private key is encrypted in DB)
    })
  } catch (error: any) {
    console.error('Key generation error:', error)
    return res.status(500).json({ message: error.message || 'Failed to generate key pair' })
  }
}

