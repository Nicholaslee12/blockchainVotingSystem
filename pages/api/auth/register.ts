import type { NextApiRequest, NextApiResponse } from 'next'
import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'

// IC format validation: 111111-11-1111 (6 digits, dash, 2 digits, dash, 4 digits)
const validateICFormat = (ic: string): boolean => {
  const icRegex = /^\d{6}-\d{2}-\d{4}$/
  return icRegex.test(String(ic))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { id, name, email, password, blockchainAddress } = req.body || {}

  if (!id || !name || !email || !password || !blockchainAddress) {
    return res
      .status(400)
      .json({ message: 'id, name, email, password and blockchainAddress are required' })
  }

  // Validate IC format
  if (!validateICFormat(id)) {
    return res
      .status(400)
      .json({ message: 'ID must be in format: 111111-11-1111 (e.g. 991231-10-1234)' })
  }

  let conn

  try {
    conn = await pool.getConnection()

    // Check for existing user by ID (IC number), email or wallet address
    const [rows] = await conn.execute(
      `SELECT id FROM users WHERE id = ?  OR blockchain_address = ? LIMIT 1`,
      [String(id), String(blockchainAddress).toLowerCase()]
    )

    if (Array.isArray(rows) && rows.length > 0) {
      // Check which field caused the duplicate
      const existingUser: any = rows[0]
      if (existingUser.id === String(id)) {
        return res
          .status(400)
          .json({ message: 'ID already registered. Please use a different ID.' })
      }
      
      return res
        .status(400)
        .json({ message: 'Wallet address already registered. Please use a different wallet.' })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(String(password), 10)

    // Insert new user
    await conn.execute(
      `INSERT INTO users (id, name, email, blockchain_address, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        String(id),
        String(name),
        String(email),
        String(blockchainAddress).toLowerCase(),
        passwordHash,
      ]
    )

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: String(id),
        name: String(name),
        email: String(email),
        blockchainAddress: String(blockchainAddress).toLowerCase(),
      },
    })
  } catch (error: any) {
    console.error('Register error:', error)
    return res
      .status(500)
      .json({ message: error.message || 'Registration failed (database error)' })
  } finally {
    if (conn) {
      conn.release()
    }
  }
}

