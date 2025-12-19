import { useState, useEffect } from 'react'
import { isAdmin } from '@/services/blockchain'

// Known admin addresses (fallback if contract check fails)
const KNOWN_ADMIN_ADDRESSES = [
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', // John Doe admin
].map(addr => addr.toLowerCase())

export const useAdmin = (wallet: string | null | undefined): boolean => {
  const [adminStatus, setAdminStatus] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      if (!wallet) {
        setAdminStatus(false)
        return
      }

      const walletLower = wallet.toLowerCase()

      // First, check if it's a known admin address (fallback)
      if (KNOWN_ADMIN_ADDRESSES.includes(walletLower)) {
        setAdminStatus(true)
        return
      }

      // Then, try to check from blockchain contract
      try {
        const status = await isAdmin(wallet)
        setAdminStatus(status)
      } catch (error) {
        console.error('Error checking admin status from contract:', error)
        // If contract check fails, fall back to known admin list
        setAdminStatus(KNOWN_ADMIN_ADDRESSES.includes(walletLower))
      }
    }

    checkAdmin()
  }, [wallet])

  return adminStatus
}

