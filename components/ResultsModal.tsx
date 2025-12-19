import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/utils/types'
import { BiTrophy } from 'react-icons/bi'
import { FaTimes } from 'react-icons/fa'
import { ContestantStruct, PollStruct } from '@/utils/types'
import { useAdmin } from '@/hooks/useAdmin'

const ResultsModal: React.FC<{
  poll: PollStruct
  contestants: ContestantStruct[]
  open: boolean
  onClose: () => void
}> = ({ poll, contestants, open, onClose }) => {
  const { wallet } = useSelector((state: RootState) => state.globalStates)
  const isAdmin = useAdmin(wallet)

  const winner = React.useMemo(() => {
    if (!contestants.length) return null
    
    // Find the maximum vote count (ensure votes are numbers)
    const maxVotes = Math.max(...contestants.map(c => Number(c.votes) || 0))
    const winnersWithMaxVotes = contestants.filter(c => (Number(c.votes) || 0) === maxVotes)
    
    // ResultsModal only shows when poll ends, so always check for tie
    if (winnersWithMaxVotes.length > 1) {
      return null // Tie - no winner
    }
    
    // Return the first contestant with max votes
    return winnersWithMaxVotes[0] || null
  }, [contestants])
  
  const isTie = React.useMemo(() => {
    if (!contestants.length) return false
    // ResultsModal only shows when poll ends, so always check for tie
    const maxVotes = Math.max(...contestants.map(c => Number(c.votes) || 0))
    const winnersWithMaxVotes = contestants.filter(c => (Number(c.votes) || 0) === maxVotes)
    return winnersWithMaxVotes.length > 1
  }, [contestants])

  const totalVotes = React.useMemo(
    () => contestants.reduce((sum, contestant) => sum + Number(contestant.votes || 0), 0),
    [contestants]
  )

  const sortedContestants = React.useMemo(() => {
    return [...contestants].sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))
  }, [contestants])

  const handleExport = React.useCallback(() => {
    if (typeof window === 'undefined') return
    window.print()
  }, [])

  if (!open || (!winner && !isTie)) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 text-white"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#0c0c10] p-8 shadow-lg shadow-[#1B5CFE]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#B0BAC9]">Election ended</p>
            <h2 className="text-3xl font-semibold leading-tight">{poll.title}</h2>
          </div>
          <button onClick={onClose} className="text-[#B0BAC9] transition hover:text-white">
            <FaTimes size={18} />
          </button>
        </div>

        <div className="rounded-2xl border border-[#2C2C2C] bg-[#121212] p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0E1933]">
                <BiTrophy size={36} className="text-[#F3C623]" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-[#B0BAC9]">
                  {isTie ? 'Result' : 'Winning contestant'}
                </p>
                {isTie ? (
                  <>
                    <p className="text-2xl font-semibold">Tie (Nobody win)</p>
                    <p className="text-sm text-[#B0BAC9]">
                      {contestants.filter(c => (Number(c.votes) || 0) === Math.max(...contestants.map(ct => Number(ct.votes) || 0))).length} contestants tied
                    </p>
                  </>
                ) : winner ? (
                  <>
                    <p className="text-2xl font-semibold">{winner.name}</p>
                    {isAdmin && <p className="text-sm text-[#B0BAC9]">{winner.votes} votes</p>}
                  </>
                ) : null}
              </div>
            </div>

            {isAdmin && (
              <div>
                <p className="text-sm uppercase tracking-widest text-[#B0BAC9]">Total votes</p>
                <p className="text-4xl font-semibold">{totalVotes}</p>
                <p className="text-xs uppercase tracking-widest text-[#B0BAC9]">
                  {poll.contestants} contestants
                </p>
              </div>
            )}
          </div>

          {isAdmin && totalVotes > 0 && (
            <div className="mt-6">
              <p className="text-sm uppercase tracking-widest text-[#B0BAC9] mb-3">Vote Tally</p>
              <div className="overflow-x-auto rounded-lg border border-[#2C2C2C]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2C2C2C] bg-[#0E1933]">
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
                      const isWinner = !isTie && winner && contestant.id === winner.id
                      return (
                        <tr
                          key={contestant.id}
                          className={`border-b border-[#2C2C2C]/50 hover:bg-[#0E1933]/50 ${
                            isWinner ? 'bg-[#0E1933]/70' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-sm text-white">
                            {index + 1}
                            {isWinner && <span className="ml-2 text-[#F3C623]">🏆</span>}
                          </td>
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

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="rounded-full border border-[#1B5CFE] px-6 py-3 text-sm font-semibold"
            >
              Export as PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-[#1B5CFE] px-6 py-3 text-sm font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultsModal

