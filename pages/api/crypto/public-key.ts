import type { NextApiRequest, NextApiResponse } from 'next'
import { getActiveKeyPair } from '@/lib/keys'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const label = (req.query.label as string) || 'default_election'

  try {
    const keypair = await getActiveKeyPair(label)

    if (!keypair) {
      return res.status(404).json({ message: `No active key found for label "${label}"` })
    }

    return res.status(200).json({
      label,
      publicKey: keypair.publicKey,
    })
  } catch (error: any) {
    console.error('Public key error:', error)
    return res
      .status(500)
      .json({ message: error.message || 'Unable to load public key for encryption' })
  }
}


