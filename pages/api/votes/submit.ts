import type { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { pollId, contestantId, voterAddress, payload } = req.body || {}

  if (!pollId || !contestantId || !voterAddress || !payload) {
    return res.status(400).json({
      message: 'pollId, contestantId, voterAddress and payload are required',
    })
  }

  const { ciphertext, iv, wrappedKey } = payload || {}

  if (!ciphertext || !iv || !wrappedKey) {
    return res.status(400).json({
      message: 'payload must include ciphertext, iv and wrappedKey',
    })
  }

  let conn

  try {
    conn = await pool.getConnection()

    await conn.execute(
      `INSERT INTO encrypted_votes
        (poll_id, contestant_id, voter_address, ciphertext_base64, iv_base64, wrapped_key_base64, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        Number(pollId),
        Number(contestantId),
        String(voterAddress).toLowerCase(),
        String(ciphertext),
        String(iv),
        String(wrappedKey),
      ]
    )

    return res.status(201).json({ message: 'Encrypted vote stored successfully' })
  } catch (error: any) {
    console.error('Encrypted vote insert error:', error)
    return res
      .status(500)
      .json({ message: error.message || 'Failed to store encrypted vote' })
  } finally {
    if (conn) {
      conn.release()
    }
  }
}


