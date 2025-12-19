import { connectWallet } from '@/services/blockchain'
import { truncate } from '@/utils/helper'
import { RootState } from '@/utils/types'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/router'
import { globalActions } from '@/store/globalSlices'
import { useAdmin } from '@/hooks/useAdmin'

const Navbar = () => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { setWallet } = globalActions
  const { wallet, poll } = useSelector((states: RootState) => states.globalStates)
  const [loggedIn, setLoggedIn] = useState(false)
  const isAdmin = useAdmin(wallet)
  // Show "Manage users" button only when admin has selected a specific poll
  const showManageUsers = isAdmin && poll !== null

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
  }, [router.asPath])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isLoggedIn')
    }
    dispatch(setWallet(''))
    router.push('/login')
  }

  return (
    <nav
      className="h-[80px] flex justify-between items-center border border-gray-400 
      px-5 rounded-full"
    >
      <Link href="/" className="text-[20px] text-blue-800 sm:text-[24px]">
        Dapp<span className="text-white font-bold">Votes</span>
      </Link>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link
            href="/admin-management"
            className="hidden sm:inline-flex h-[40px] items-center rounded-full border border-[#1B5CFE] px-4 text-xs font-semibold text-white hover:bg-[#1B5CFE]/20"
          >
            Admin Management
          </Link>
        )}

        {showManageUsers && (
          <Link
            href="/manage-users"
            className="inline-flex h-[40px] items-center rounded-full border border-[#1B5CFE] px-4 text-xs font-semibold text-white hover:bg-[#1B5CFE]/20"
          >
            Manage users
          </Link>
        )}

        {wallet && (
          <Link
            href="/user-dashboard"
            className="hidden sm:inline-flex h-[40px] items-center rounded-full border border-[#1B5CFE] px-4 text-xs font-semibold text-white hover:bg-[#1B5CFE]/20"
          >
            My Dashboard
          </Link>
        )}

        {wallet ? (
          <>
            <button
              className="h-[48px] w-[130px] 
              sm:w-[148px] px-3 rounded-full text-sm font-bold
              transition-all duration-300 bg-[#1B5CFE] hover:bg-blue-500"
            >
              {truncate({ text: wallet, startChars: 4, endChars: 4, maxLength: 11 })}
            </button>
            {loggedIn && (
              <button
                onClick={handleLogout}
                className="h-[40px] items-center rounded-full border border-[#1B5CFE] px-4 text-xs font-semibold text-white hover:bg-[#1B5CFE]/20 hidden sm:inline-flex"
              >
                Logout
              </button>
            )}
          </>
        ) : (
          <button
            className="h-[48px] w-[130px] 
            sm:w-[148px] px-3 rounded-full text-sm font-bold
            transition-all duration-300 bg-[#1B5CFE] hover:bg-blue-500"
            onClick={connectWallet}
          >
            Connect wallet
          </button>
        )}
      </div>
    </nav>
  )
}

export default Navbar
