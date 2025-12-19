import Contestants from '@/components/Contestants'
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import { RootState } from '@/utils/types'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { useSelector } from 'react-redux'

const Dashboard = () => {
  const { poll, contestants } = useSelector((states: RootState) => states.globalStates)
  const router = useRouter()

  const totalVotes = React.useMemo(
    () => contestants.reduce((total, contestant) => total + Number(contestant.votes || 0), 0),
    [contestants]
  )

  const uniqueVoters = React.useMemo(() => {
    if (!poll?.voters) return 0
    return new Set(poll.voters.map((v) => v.toLowerCase())).size
  }, [poll])

  const votingStatus = React.useMemo(() => {
    if (!poll) return 'Unknown'
    const now = Date.now()
    const start = Number(poll.startsAt)
    const end = Number(poll.endsAt)

    if (!start || !end) return 'Unknown'
    if (now < start) return 'Not started'
    if (now >= start && now < end) return 'Active'
    return 'Ended'
  }, [poll])

  const leaderBoard = React.useMemo(
    () => [...contestants].sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0)).slice(0, 3),
    [contestants]
  )

  const sortedContestants = React.useMemo(() => {
    return [...contestants].sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))
  }, [contestants])

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050608] text-white px-6 text-center">
        <div className="space-y-6">
          <h1 className="text-3xl font-semibold">No poll selected</h1>
          <p className="text-[#B0BAC9]">
            Visit a poll first to populate the dashboard and review live results.
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-[30.5px] bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white"
          >
            Go to polls
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Results Dashboard | {poll.title}</title>
      </Head>

      <div className="min-h-screen relative backdrop-blur text-white">
        <div
          className="absolute inset-0 before:absolute before:inset-0
          before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
          before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 space-y-10 sm:p-10">
          <Navbar />

          <div
            className="grid grid-cols-1 gap-6 lg:grid-cols-3 bg-[#151515]/70 border
            border-[#2C2C2C] rounded-[24px] p-6"
          >
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-widest text-[#B0BAC9]">Active poll</p>
              <p className="text-2xl font-semibold">{poll.title}</p>
              <p className="text-sm text-[#B0BAC9]">{poll.description}</p>
              <p className="mt-2 text-xs uppercase tracking-widest text-[#B0BAC9]">
                Status: <span className="font-semibold text-white">{votingStatus}</span>
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-[#B0BAC9]">Election stats</p>
              <p className="text-4xl font-semibold">{totalVotes}</p>
              <p className="text-sm text-[#B0BAC9]">
                {poll.contestants} contestants · {uniqueVoters} unique voters
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-[#B0BAC9]">Leaderboard</p>
              <ul className="mt-2 space-y-2">
                {leaderBoard.length ? (
                  leaderBoard.map((contestant, index) => (
                    <li
                      key={contestant.id}
                      className="flex items-center justify-between rounded-[16px] bg-[#0E1933] px-4 py-2"
                    >
                      <span className="text-sm text-[#B0BAC9]">#{index + 1}</span>
                      <span className="flex-1 px-2 text-sm">{contestant.name}</span>
                      <span className="text-sm font-semibold">{contestant.votes} votes</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-[#B0BAC9]">No contestants.</li>
                )}
              </ul>
            </div>
          </div>

          {contestants.length > 0 && (
            <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6">
              <h2 className="text-xl font-semibold mb-4">Vote Tally</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#2C2C2C]">
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-widest text-[#B0BAC9]">Rank</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-widest text-[#B0BAC9]">Contestant</th>
                      <th className="text-right py-3 px-4 text-xs uppercase tracking-widest text-[#B0BAC9]">Votes</th>
                      <th className="text-right py-3 px-4 text-xs uppercase tracking-widest text-[#B0BAC9]">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedContestants.map((contestant, index) => {
                      const votes = Number(contestant.votes || 0)
                      const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(2) : '0.00'
                      return (
                        <tr
                          key={contestant.id}
                          className="border-b border-[#2C2C2C]/50 hover:bg-[#0E1933]/50 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm text-white">#{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-white font-medium">{contestant.name}</td>
                          <td className="py-3 px-4 text-sm text-white text-right font-semibold">{votes}</td>
                          <td className="py-3 px-4 text-sm text-white text-right">{percentage}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Contestants poll={poll} contestants={contestants} />
          <Footer />
        </section>
      </div>
    </>
  )
}

export default Dashboard

