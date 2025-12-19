import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { RootState } from '@/utils/types'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { useSelector } from 'react-redux'
import { truncate } from '@/utils/helper'
import { useAdmin } from '@/hooks/useAdmin'

const ManageUsersPage = () => {
  const router = useRouter()
  const { wallet, poll, contestants } = useSelector((states: RootState) => states.globalStates)
  const [generatingKeys, setGeneratingKeys] = React.useState(false)
  const [tallying, setTallying] = React.useState(false)
  const [tallyResult, setTallyResult] = React.useState<any>(null)
  const [keyGenResult, setKeyGenResult] = React.useState<string | null>(null)
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

  const uniqueVoters = React.useMemo(() => {
    if (!poll?.voters) return []
    return Array.from(new Set(poll.voters.map((v) => v.toLowerCase())))
  }, [poll])

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
            users.
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
        <title>Admin | Manage Users</title>
      </Head>
      <div className="min-h-screen relative backdrop-blur text-white">
        <div
          className="absolute inset-0 before:absolute before:inset-0
          before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
          before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 space-y-10 sm:p-10">
          <Navbar />

          <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Manage users</h1>
            {poll ? (
              <>
                <p className="text-sm text-[#B0BAC9]">
                  Current poll: <span className="font-semibold text-white">{poll.title}</span>
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                      Director
                    </h2>
                    <div className="rounded-2xl bg-[#0E1933] px-4 py-3 text-sm">
                      <p className="font-semibold">{truncate({ text: poll.director, startChars: 4, endChars: 4, maxLength: 11 })}</p>
                      <p className="text-[#B0BAC9]">Poll owner</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                      Unique voters
                    </h2>
                    <div className="rounded-2xl bg-[#0E1933] px-4 py-3 text-sm space-y-1 max-h-48 overflow-y-auto">
                      {uniqueVoters.length ? (
                        uniqueVoters.map((voter) => (
                          <p key={voter}>
                            {truncate({ text: voter, startChars: 4, endChars: 4, maxLength: 11 })}
                          </p>
                        ))
                      ) : (
                        <p className="text-[#B0BAC9]">No votes yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                    Contestant owners
                  </h2>
                  <div className="rounded-2xl bg-[#0E1933] px-4 py-3 text-sm max-h-64 overflow-y-auto">
                    {contestants.length ? (
                      <ul className="space-y-2">
                        {contestants.map((contestant) => (
                          <li key={contestant.id} className="flex flex-col">
                            <span className="font-semibold">{contestant.name}</span>
                            <span className="text-[#B0BAC9]">
                              Owner: {truncate({ text: contestant.voter, startChars: 4, endChars: 4, maxLength: 11 })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#B0BAC9]">No contestants yet.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#B0BAC9]">
                No poll selected. Open a poll first to see users for that election.
              </p>
            )}
          </div>

          {/* Encryption Admin Section */}
          <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Encryption & Vote Tally</h1>

            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                  Generate Keypair
                </h2>
                <p className="text-xs text-[#B0BAC9]">
                  Generate a new RSA keypair and save it to MySQL (encrypted private key).
                </p>
                <button
                  onClick={async () => {
                    if (!wallet) return
                    setGeneratingKeys(true)
                    setKeyGenResult(null)
                    try {
                      const res = await fetch('/api/admin/generate-keys', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adminAddress: wallet }),
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setKeyGenResult(`✅ ${data.message}`)
                      } else {
                        setKeyGenResult(`❌ ${data.message}`)
                      }
                    } catch (err: any) {
                      setKeyGenResult(`❌ ${err.message}`)
                    } finally {
                      setGeneratingKeys(false)
                    }
                  }}
                  disabled={generatingKeys || !wallet}
                  className="rounded-[16px] bg-[#1B5CFE] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4fe0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generatingKeys ? 'Generating...' : 'Generate Keypair'}
                </button>
                {keyGenResult && (
                  <p className="text-xs text-[#B0BAC9] mt-2">{keyGenResult}</p>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                  Decrypt & Tally Votes
                </h2>
                <p className="text-xs text-[#B0BAC9]">
                  Decrypt all encrypted votes for the current poll and show the tally.
                </p>
                {poll ? (
                  <>
                    <button
                      onClick={async () => {
                        if (!wallet || !poll) return
                        setTallying(true)
                        setTallyResult(null)
                        try {
                          const res = await fetch('/api/admin/tally', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              pollId: poll.id,
                              adminAddress: wallet,
                            }),
                          })
                          const data = await res.json()
                          setTallyResult(data)
                        } catch (err: any) {
                          setTallyResult({ error: err.message })
                        } finally {
                          setTallying(false)
                        }
                      }}
                      disabled={tallying || !wallet || !poll}
                      className="rounded-[16px] bg-[#1B5CFE] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4fe0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {tallying ? 'Decrypting & Tallying...' : `Tally Poll #${poll.id}`}
                    </button>
                    {tallyResult && (
                      <div className="mt-4 rounded-2xl bg-[#0E1933] px-4 py-3 text-sm space-y-2 max-h-96 overflow-y-auto">
                        {tallyResult.error ? (
                          <p className="text-red-400">❌ {tallyResult.error}</p>
                        ) : (
                          <>
                            <p className="text-[#B0BAC9]">
                              Total votes: <span className="text-white font-semibold">{tallyResult.totalVotes}</span>
                            </p>
                            <p className="text-[#B0BAC9]">
                              Successfully decrypted: <span className="text-white font-semibold">{tallyResult.successfulDecryptions}</span>
                            </p>
                            {tallyResult.failedDecryptions > 0 && (
                              <p className="text-yellow-400">
                                Failed decryptions: {tallyResult.failedDecryptions}
                              </p>
                            )}
                            {Object.keys(tallyResult.tally || {}).length > 0 && (
                              <div className="mt-3">
                                <p className="text-[#B0BAC9] font-semibold mb-3">Tally by Contestant:</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-[#2C2C2C]">
                                        <th className="text-left py-2 px-3 text-xs uppercase tracking-widest text-[#B0BAC9]">Contestant</th>
                                        <th className="text-right py-2 px-3 text-xs uppercase tracking-widest text-[#B0BAC9]">Votes</th>
                                        <th className="text-right py-2 px-3 text-xs uppercase tracking-widest text-[#B0BAC9]">Percentage</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(tallyResult.tally)
                                        .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)
                                        .map(([cid, count]: [string, any]) => {
                                          const contestant = contestants.find(c => Number(c.id) === Number(cid))
                                          const contestantName = contestant?.name || `Contestant #${cid}`
                                          const percentage = tallyResult.totalVotes > 0 
                                            ? ((Number(count) / tallyResult.totalVotes) * 100).toFixed(2)
                                            : '0.00'
                                          return (
                                            <tr key={cid} className="border-b border-[#2C2C2C]/50 hover:bg-[#0E1933]/50">
                                              <td className="py-2 px-3 text-sm text-white">{contestantName}</td>
                                              <td className="py-2 px-3 text-sm text-white text-right font-semibold">{count}</td>
                                              <td className="py-2 px-3 text-sm text-white text-right">{percentage}%</td>
                                            </tr>
                                          )
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {tallyResult.decryptedVotes && tallyResult.decryptedVotes.length > 0 && (
                              <details className="mt-3">
                                <summary className="text-[#B0BAC9] cursor-pointer">View all decrypted votes</summary>
                                <pre className="mt-2 text-xs text-[#B0BAC9] overflow-x-auto">
                                  {JSON.stringify(tallyResult.decryptedVotes, null, 2)}
                                </pre>
                              </details>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[#B0BAC9]">
                    Select a poll first to tally votes.
                  </p>
                )}
              </div>
            </div>
          </div>

          <Footer />
        </section>
      </div>
    </>
  )
}

export default ManageUsersPage


