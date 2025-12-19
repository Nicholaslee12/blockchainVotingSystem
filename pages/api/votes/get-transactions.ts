import type { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { pollId, voterAddress } = req.query || {}

  if (!pollId) {
    return res.status(400).json({
      message: 'pollId is required',
    })
  }

  let conn

  try {
    conn = await pool.getConnection()

    let transactions: any[] = []

    // Try to get from vote_transactions table first
    try {
      const [txRows] = await conn.execute(
        `SELECT 
          transaction_hash,
          from_address,
          to_address,
          transaction_timestamp
         FROM vote_transactions
         WHERE poll_id = ? ${voterAddress ? 'AND voter_address = ?' : ''}
         ORDER BY transaction_timestamp DESC, created_at DESC`,
        voterAddress 
          ? [Number(pollId), String(voterAddress).toLowerCase()]
          : [Number(pollId)]
      )
      transactions = txRows as any[]
    } catch (err: any) {
      // If table doesn't exist, try encrypted_votes table
      if (err.message?.includes("doesn't exist") || err.message?.includes("Unknown table")) {
        try {
          const [rows] = await conn.execute(
            `SELECT 
              transaction_hash,
              from_address,
              to_address,
              transaction_timestamp
             FROM encrypted_votes
             WHERE poll_id = ? AND transaction_hash IS NOT NULL ${voterAddress ? 'AND voter_address = ?' : ''}
             ORDER BY COALESCE(transaction_timestamp, created_at) DESC`,
            voterAddress 
              ? [Number(pollId), String(voterAddress).toLowerCase()]
              : [Number(pollId)]
          )
          transactions = rows as any[]
        } catch (err2: any) {
          if (err2.message?.includes("Unknown column")) {
            // Columns don't exist, return empty array
            return res.status(200).json({ transactions: [] })
          }
          throw err2
        }
      } else {
        throw err
      }
    }

    return res.status(200).json({ transactions })
  } catch (error: any) {
    console.error('Transaction fetch error:', error)
    return res
      .status(500)
      .json({ message: error.message || 'Failed to fetch transactions' })
  } finally {
    if (conn) {
      conn.release()
    }
  }
}

