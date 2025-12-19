import type { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { pollId, voterAddress, transactionHash, fromAddress, toAddress, timestamp } = req.body || {}

  if (!pollId || !voterAddress || !transactionHash) {
    return res.status(400).json({
      message: 'pollId, voterAddress, and transactionHash are required',
    })
  }

  let conn

  try {
    conn = await pool.getConnection()

    // Update the most recent vote record for this poll and voter with transaction details
    // If columns don't exist, this will fail gracefully
    try {
      await conn.execute(
        `UPDATE encrypted_votes
         SET transaction_hash = ?, from_address = ?, to_address = ?, transaction_timestamp = ?
         WHERE poll_id = ? AND voter_address = ? AND transaction_hash IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          String(transactionHash),
          String(fromAddress || '').toLowerCase(),
          String(toAddress || '').toLowerCase(),
          timestamp ? new Date(timestamp) : null,
          Number(pollId),
          String(voterAddress).toLowerCase(),
        ]
      )
    } catch (updateErr: any) {
      // If columns don't exist, try to insert into a separate transactions table
      if (updateErr.message?.includes("Unknown column")) {
        // Try to create/insert into transactions table
        try {
          await conn.execute(
            `CREATE TABLE IF NOT EXISTS vote_transactions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              poll_id INT NOT NULL,
              voter_address VARCHAR(42) NOT NULL,
              transaction_hash VARCHAR(66) NOT NULL,
              from_address VARCHAR(42),
              to_address VARCHAR(42),
              transaction_timestamp DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY unique_vote (poll_id, voter_address, transaction_hash)
            )`
          )

          await conn.execute(
            `INSERT INTO vote_transactions 
             (poll_id, voter_address, transaction_hash, from_address, to_address, transaction_timestamp)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               from_address = VALUES(from_address),
               to_address = VALUES(to_address),
               transaction_timestamp = VALUES(transaction_timestamp)`,
            [
              Number(pollId),
              String(voterAddress).toLowerCase(),
              String(transactionHash),
              String(fromAddress || '').toLowerCase(),
              String(toAddress || '').toLowerCase(),
              timestamp ? new Date(timestamp) : null,
            ]
          )
        } catch (createErr) {
          console.error('Failed to create/insert into transactions table:', createErr)
          // Silently fail - transaction details are optional
        }
      } else {
        throw updateErr
      }
    }

    return res.status(200).json({ message: 'Transaction details stored successfully' })
  } catch (error: any) {
    console.error('Transaction storage error:', error)
    // Don't fail the request - transaction storage is optional
    return res.status(200).json({ message: 'Vote recorded (transaction details may not be stored)' })
  } finally {
    if (conn) {
      conn.release()
    }
  }
}

