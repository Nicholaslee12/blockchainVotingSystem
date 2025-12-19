import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { RootState } from '@/utils/types'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { useSelector } from 'react-redux'
import { useAdmin } from '@/hooks/useAdmin'
import { toast } from 'react-toastify'

const AdminManagementPage = () => {
  const router = useRouter()
  const { wallet } = useSelector((states: RootState) => states.globalStates)
  const [newAdminAddress, setNewAdminAddress] = React.useState('')
  const [removingAdminAddress, setRemovingAdminAddress] = React.useState('')
  const [addingAdmin, setAddingAdmin] = React.useState(false)
  const [removingAdmin, setRemovingAdmin] = React.useState(false)
  const [checkingAdmin, setCheckingAdmin] = React.useState(true)
  const isAdmin = useAdmin(wallet)

  // Track admin check status and log for debugging
  React.useEffect(() => {
    if (wallet) {
      console.log('🔍 Checking admin status for wallet:', wallet)
      setCheckingAdmin(true)
      const checkAdminStatus = async () => {
        try {
          const { isAdmin: checkAdmin } = await import('@/services/blockchain')
          const adminStatus = await checkAdmin(wallet)
          console.log('✅ Admin status from contract:', adminStatus)
        } catch (error) {
          console.error('❌ Admin check error:', error)
        } finally {
          setCheckingAdmin(false)
        }
      }
      checkAdminStatus()
    } else {
      console.log('⚠️ No wallet connected')
      setCheckingAdmin(false)
    }
  }, [wallet])

  // Log admin status for debugging
  React.useEffect(() => {
    console.log('👤 Current admin status:', isAdmin, 'Wallet:', wallet)
  }, [isAdmin, wallet])

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-[#050608] text-white">
        <section className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-6">
          <h1 className="text-3xl font-semibold">Checking admin status...</h1>
        </section>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-[#050608] text-white">
        <section className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-6">
          <h1 className="text-3xl font-semibold">Admin access only</h1>
          <p className="text-[#B0BAC9] max-w-md">
            This page is only available to admin wallets. Connect with an admin wallet to manage
            admins.
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-[30.5px] bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white"
          >
            Go back home
          </button>
        </section>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Admin | Admin Management</title>
      </Head>
      <div className="min-h-screen relative backdrop-blur text-white">
        <div
          className="absolute inset-0 before:absolute before:inset-0
          before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
          before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 space-y-10 sm:p-10">
          <Navbar />

          {/* Admin Management Section */}
          <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Admin Management</h1>

            <div className="space-y-4">
              <div className="space-y-3">
                <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                  Add New Admin
                </h2>
                <p className="text-xs text-[#B0BAC9]">
                  Add a new wallet address as an admin. Admins can create polls and manage the system.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    placeholder="Enter wallet address (0x...)"
                    className="flex-1 px-4 py-2 rounded-lg bg-[#0E0E0E] border border-[#2C2C2C] text-white placeholder-[#B0BAC9] focus:outline-none focus:border-[#1B5CFE]"
                  />
                  <button
                    onClick={async () => {
                      if (!wallet || !newAdminAddress) {
                        toast.error('Please enter a wallet address')
                        return
                      }
                      setAddingAdmin(true)
                      try {
                        const { addAdmin } = await import('@/services/blockchain')
                        await addAdmin(newAdminAddress)
                        toast.success('Admin added successfully!')
                        setNewAdminAddress('')
                      } catch (error: any) {
                        toast.error(error.message || 'Failed to add admin')
                      } finally {
                        setAddingAdmin(false)
                      }
                    }}
                    disabled={addingAdmin || !newAdminAddress}
                    className="px-6 py-2 rounded-lg bg-[#1B5CFE] text-white font-semibold hover:bg-[#1a4fe0] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingAdmin ? 'Adding...' : 'Add Admin'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                  Remove Admin
                </h2>
                <p className="text-xs text-[#B0BAC9]">
                  Remove admin privileges from a wallet address. The contract owner cannot be removed.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={removingAdminAddress}
                    onChange={(e) => setRemovingAdminAddress(e.target.value)}
                    placeholder="Enter wallet address to remove (0x...)"
                    className="flex-1 px-4 py-2 rounded-lg bg-[#0E0E0E] border border-[#2C2C2C] text-white placeholder-[#B0BAC9] focus:outline-none focus:border-[#1B5CFE]"
                  />
                  <button
                    onClick={async () => {
                      if (!wallet || !removingAdminAddress) {
                        toast.error('Please enter a wallet address')
                        return
                      }
                      setRemovingAdmin(true)
                      try {
                        const { removeAdmin } = await import('@/services/blockchain')
                        await removeAdmin(removingAdminAddress)
                        toast.success('Admin removed successfully!')
                        setRemovingAdminAddress('')
                      } catch (error: any) {
                        toast.error(error.message || 'Failed to remove admin')
                      } finally {
                        setRemovingAdmin(false)
                      }
                    }}
                    disabled={removingAdmin || !removingAdminAddress}
                    className="px-6 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {removingAdmin ? 'Removing...' : 'Remove Admin'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Footer />
        </section>
      </div>
    </>
  )
}

export default AdminManagementPage

