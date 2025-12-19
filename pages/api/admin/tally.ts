import type { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@/lib/db'
import { decryptVote } from '@/lib/decrypt'
import { isAdmin } from '@/services/blockchain'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { pollId, adminAddress, label } = req.body || {}

  if (!pollId) {
    return res.status(400).json({ message: 'pollId is required' })
  }

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

  let conn

  try {
    conn = await pool.getConnection()

    // Fetch all encrypted votes for this poll
    const [rows] = await conn.execute(
      `SELECT id, poll_id, contestant_id, voter_address, 
              ciphertext_base64, iv_base64, wrapped_key_base64, created_at
       FROM encrypted_votes
       WHERE poll_id = ?
       ORDER BY created_at ASC`,
      [Number(pollId)]
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({
        pollId: Number(pollId),
        totalVotes: 0,
        decryptedVotes: [],
        tally: {},
        message: 'No encrypted votes found for this poll',
      })
    }

    // Decrypt each vote
    const decryptedVotes: Array<{
      id: number
      contestantId: number
      voterAddress: string
      voteData: unknown
      createdAt: string
      decryptionError?: string
    }> = []

    const tally: Record<number, number> = {}

    for (const row of rows as any[]) {
      try {
        const voteData = await decryptVote(
          {
            ciphertext: String(row.ciphertext_base64),
            iv: String(row.iv_base64),
            wrappedKey: String(row.wrapped_key_base64),
          },
          label || 'default_election'
        )

        const voteObj = voteData as { pollId?: number; contestantId?: number; voter?: string }
        const contestantId = voteObj.contestantId || Number(row.contestant_id)

        decryptedVotes.push({
          id: Number(row.id),
          contestantId,
          voterAddress: String(row.voter_address),
          voteData: voteObj,
          createdAt: String(row.created_at),
        })

        // Tally
        if (!tally[contestantId]) {
          tally[contestantId] = 0
        }
        tally[contestantId]++
      } catch (error: any) {
        console.error(`Failed to decrypt vote ID ${row.id}:`, error)
        decryptedVotes.push({
          id: Number(row.id),
          contestantId: Number(row.contestant_id),
          voterAddress: String(row.voter_address),
          voteData: null,
          createdAt: String(row.created_at),
          decryptionError: error.message || 'Decryption failed',
        })
      }
    }

    return res.status(200).json({
      pollId: Number(pollId),
      totalVotes: rows.length,
      successfulDecryptions: decryptedVotes.filter((v) => !v.decryptionError).length,
      failedDecryptions: decryptedVotes.filter((v) => v.decryptionError).length,
      decryptedVotes,
      tally,
      message: `Successfully decrypted and tallied ${decryptedVotes.filter((v) => !v.decryptionError).length} votes`,
    })
  } catch (error: any) {
    console.error('Tally error:', error)
    return res.status(500).json({ message: error.message || 'Failed to tally votes' })
  } finally {
    if (conn) {
      conn.release()
    }
  }
}

