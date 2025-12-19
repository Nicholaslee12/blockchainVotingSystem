import mysql from 'mysql2/promise'

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key]

  // If the variable is not set at all, fall back (if provided)
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing environment variable: ${key}`)
  }

  // If it's set (even to an empty string), use it as-is
  return value
}

export const pool = mysql.createPool({
  host: getEnv('DB_HOST', 'localhost'),
  user: getEnv('DB_USER', 'root'),
  password: getEnv('DB_PASSWORD', ''),
  database: getEnv('DB_NAME', 'voting_app'),
  port: Number(process.env.DB_PORT || 3306),
  connectionLimit: 10,
})


