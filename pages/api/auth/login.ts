import type { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'

// IC format validation: 111111-11-1111 (6 digits, dash, 2 digits, dash, 4 digits)
const validateICFormat = (ic: string): boolean => {
  const icRegex = /^\d{6}-\d{2}-\d{4}$/
  return icRegex.test(String(ic))
}

// Check if identifier looks like an IC number
const isICNumber = (value: string): boolean => {
  return /^\d{6}-\d{2}-\d{4}$/.test(String(value))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { identifier, password, blockchainAddress } = req.body || {}

  if (!identifier || !password || !blockchainAddress) {
    return res
      .status(400)
      .json({ message: 'id, password and blockchainAddress are required' })
  }

  // Validate ID format - must be in correct format
  if (!validateICFormat(identifier)) {
    return res
      .status(400)
      .json({ message: 'ID must be in format: 111111-11-1111 (e.g. 991231-10-1234)' })
  }

  let conn

  try {
    conn = await pool.getConnection()

    // Login only with ID (IC number)
    const [rows] = await conn.execute(
      `SELECT id, name, email, blockchain_address, password_hash, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [String(identifier)]
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({ message: 'User not found' })
    }

    const row: any = rows[0]
    const dbAddress = String(row.blockchain_address || '').toLowerCase()
    const incoming = String(blockchainAddress).toLowerCase()

    if (dbAddress !== incoming) {
      return res
        .status(401)
        .json({ message: 'Wallet address does not match this user' })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      String(password),
      String(row.password_hash || '')
    )

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid password' })
    }

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        blockchainAddress: dbAddress,
        createdAt: row.created_at,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return res
      .status(500)
      .json({ message: error.message || 'Login failed (database error)' })
  } finally {
    if (conn) {
      conn.release()
    }
  }
}

