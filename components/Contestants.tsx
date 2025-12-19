import { deleteContestant as deleteContestantOnChain, updateContestant as updateContestantOnChain, voteCandidate } from '@/services/blockchain'
import { globalActions } from '@/store/globalSlices'
import { truncate } from '@/utils/helper'
import { ContestantStruct, PollStruct, RootState } from '@/utils/types'
import Image from 'next/image'
import React from 'react'
import { BiTrophy, BiUpvote } from 'react-icons/bi'
import { FaTimes } from 'react-icons/fa'
import { MdDelete, MdEdit } from 'react-icons/md'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { useRouter } from 'next/router'
import { useAdmin } from '@/hooks/useAdmin'

type ManageModalState = {
  contestant: ContestantStruct
} | null

type SearchState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string }
  | { status: 'not_found'; message: string }
  | { status: 'found'; contestant: ContestantStruct }

const Contestants: React.FC<{ contestants: ContestantStruct[]; poll: PollStruct }> = ({
  contestants,
  poll,
}) => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { setContestModal, setPoll } = globalActions
  const { wallet } = useSelector((states: RootState) => states.globalStates)

  const walletAddress = wallet?.toLowerCase() || ''
  const isAdmin = useAdmin(wallet)
  const directorAddress = poll.director?.toLowerCase() || ''
  const votingStarted = poll.votes > 0
  const canManageContestants = Boolean(walletAddress && walletAddress === directorAddress)

  const [manageModal, setManageModal] = React.useState<ManageModalState>(null)
  const [formValues, setFormValues] = React.useState({ name: '', image: '' })
  const [formLoading, setFormLoading] = React.useState(false)

  const [searchAddress, setSearchAddress] = React.useState('')
  const [searchState, setSearchState] = React.useState<SearchState>({ status: 'idle' })

  const totalVotes = React.useMemo(
    () =>
      contestants.reduce((votesAcc, current) => votesAcc + Number(current.votes || 0), 0),
    [contestants]
  )

  const winner = React.useMemo(() => {
    if (!contestants.length) return null
    
    // Find the maximum vote count (ensure votes are numbers)
    const maxVotes = Math.max(...contestants.map(c => Number(c.votes) || 0))
    const winnersWithMaxVotes = contestants.filter(c => (Number(c.votes) || 0) === maxVotes)
    
    // Check for tie - show tie whenever there's a tie, regardless of poll status
    if (winnersWithMaxVotes.length > 1) {
      return null // Tie - no winner
    }
    
    // Return the first contestant with max votes (leading contestant)
    return winnersWithMaxVotes[0] || null
  }, [contestants])
  
  const isTie = React.useMemo(() => {
    // Show tie whenever there's a tie, regardless of poll status
    if (!contestants.length) return false
    const maxVotes = Math.max(...contestants.map(c => Number(c.votes) || 0))
    const winnersWithMaxVotes = contestants.filter(c => (Number(c.votes) || 0) === maxVotes)
    return winnersWithMaxVotes.length > 1
  }, [contestants])

  const handleExportResults = React.useCallback(() => {
    if (typeof window === 'undefined') return
    window.print()
  }, [])

  const handleViewDashboard = React.useCallback(() => {
    router.push('/dashboard')
  }, [router])

  const isDashboardRoute = router.pathname === '/dashboard'

  const openEditModal = (contestant: ContestantStruct) => {
    setFormValues({ name: contestant.name, image: contestant.image })
    setManageModal({ contestant })
  }

  const closeManageModal = () => {
    setManageModal(null)
    setFormValues({ name: '', image: '' })
    setFormLoading(false)
  }

  const handleManageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleManageSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!manageModal) return

    try {
      setFormLoading(true)
      await toast.promise(
        updateContestantOnChain(poll.id, manageModal.contestant.id, {
          name: formValues.name,
          image: formValues.image,
        }),
        {
          pending: 'Updating contestant...',
          success: 'Contestant updated!',
          error: {
            render({ data }) {
              return (data as Error)?.message || 'Encountered error!'
            },
          },
        }
      )
      closeManageModal()
      
      // Wait a moment for state to update, then refresh to show updated avatars
      setTimeout(() => {
        router.replace(router.asPath)
      }, 500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Encountered error!'
      toast.error(message)
      console.error('updateContestant failed', error)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteContestant = async (contestant: ContestantStruct) => {
    try {
      await toast.promise(deleteContestantOnChain(poll.id, contestant.id), {
        pending: 'Removing contestant...',
        success: 'Contestant removed!',
        error: {
          render({ data }) {
            return (data as Error)?.message || 'Encountered error!'
          },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Encountered error!'
      toast.error(message)
      console.error('deleteContestant failed', error)
    }
  }

  const handleAddContestantClick = () => {
    dispatch(setContestModal('scale-100'))
  }

  const handleWalletSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = searchAddress.trim().toLowerCase()

    if (!normalized || !normalized.startsWith('0x') || normalized.length !== 42) {
      setSearchState({ status: 'invalid', message: 'Enter a valid wallet address.' })
      return
    }

    const matchedContestant = contestants.find((contestant) =>
      contestant.voters.includes(normalized)
    )

    if (matchedContestant) {
      setSearchState({ status: 'found', contestant: matchedContestant })
      return
    }

    setSearchState({
      status: 'not_found',
      message: 'No vote recorded for this wallet in the current poll.',
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-center text-[48px] font-[600px]">Contestants</h1>

      {(winner || isTie) && (
        <div
          className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] text-white
          px-6 py-6 space-y-6"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#0E1933] flex items-center justify-center">
                <BiTrophy size={28} className="text-[#F3C623]" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wider text-[#B0BAC9]">Leading contestant</p>
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
                    {isAdmin && (
                      <p className="text-sm text-[#B0BAC9]">{winner.votes} votes</p>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {isAdmin && (
              <div>
                <p className="text-sm uppercase tracking-wider text-[#B0BAC9]">Total votes</p>
                <p className="text-4xl font-semibold">{totalVotes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleExportResults}
                className="rounded-[30.5px] border border-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white"
              >
                Export as PDF
              </button>
              {!isDashboardRoute && (
                <button
                  onClick={handleViewDashboard}
                  className="rounded-[30.5px] bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white"
                >
                  View in Dashboard
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#0E0E0E] border border-[#2C2C2C] rounded-[18px] px-4 py-5 space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#B0BAC9]">
              Verify your vote
            </p>
            <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleWalletSearch}>
              <input
                value={searchAddress}
                onChange={(event) => setSearchAddress(event.target.value)}
                placeholder="Enter wallet address"
                className="flex-1 rounded-full border border-[#2C2C2C] bg-transparent px-4 py-3 text-sm outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white"
              >
                Search
              </button>
            </form>
            {searchState.status === 'invalid' && (
              <p className="text-sm text-[#FE6B6B]">{searchState.message}</p>
            )}
            {searchState.status === 'not_found' && (
              <p className="text-sm text-[#FE6B6B]">{searchState.message}</p>
            )}
            {searchState.status === 'found' && (
              <p className="text-sm text-[#4ADE80]">
                This wallet voted for <span className="font-semibold">{searchState.contestant.name}</span>.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 pb-7 gap-[62px] sm:w-2/3 xl:w-11/12 mx-auto">
        {contestants.map((contestant) => {
          const ownsEntry = Boolean(walletAddress && contestant.voter === walletAddress)
          const canEdit = !votingStarted && (canManageContestants || ownsEntry)
          const canDelete = canEdit

          return (
            <Contestant
              poll={poll}
              contestant={contestant}
              key={contestant.id}
              wallet={walletAddress}
              isAdmin={isAdmin}
              onEdit={openEditModal}
              onDelete={handleDeleteContestant}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )
        })}
      </div>

      {manageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0c0c10] p-6 text-white shadow-lg shadow-[#1B5CFE]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold">Edit contestant</p>
              <button onClick={closeManageModal} className="text-[#B0BAC9] hover:text-white">
                <FaTimes />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleManageSubmit}>
              <div>
                <label className="text-xs uppercase tracking-widest text-[#B0BAC9]">Name</label>
                <input
                  name="name"
                  value={formValues.name}
                  onChange={handleManageChange}
                  required
                  className="mt-2 w-full rounded-full border border-[#212D4A] bg-transparent px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-[#B0BAC9]">
                  Avatar URL
                </label>
                <input
                  name="image"
                  value={formValues.image}
                  onChange={handleManageChange}
                  required
                  type="url"
                  className="mt-2 w-full rounded-full border border-[#212D4A] bg-transparent px-4 py-3 text-sm outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className={`w-full rounded-full px-4 py-3 text-sm font-semibold ${
                  formLoading ? 'bg-[#B0BAC9] cursor-not-allowed' : 'bg-[#1B5CFE]'
                }`}
              >
                {formLoading ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const Contestant: React.FC<{
  contestant: ContestantStruct
  poll: PollStruct
  wallet?: string
  isAdmin: boolean
  onEdit: (contestant: ContestantStruct) => void
  onDelete: (contestant: ContestantStruct) => void
  canEdit: boolean
  canDelete: boolean
}> = ({ contestant, poll, wallet, isAdmin, onEdit, onDelete, canEdit, canDelete }) => {
  const walletAddress = wallet?.toLowerCase()
  const hasVoted = walletAddress ? poll.voters.includes(walletAddress) : false
  const votedForThisContestant = walletAddress ? contestant.voters.includes(walletAddress) : false

  // Check if poll has ended or not started
  // Use a state that updates every second to ensure real-time status
  const [currentTime, setCurrentTime] = React.useState(Date.now())
  
  React.useEffect(() => {
    // Update current time every second to ensure button state updates in real-time
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const pollStatus = React.useMemo(() => {
    const now = currentTime
    // Handle both string and number formats for timestamps
    const start = typeof poll.startsAt === 'string' 
      ? new Date(poll.startsAt).getTime() 
      : Number(poll.startsAt)
    const end = typeof poll.endsAt === 'string' 
      ? new Date(poll.endsAt).getTime() 
      : Number(poll.endsAt)
    
    if (!start || !end || isNaN(start) || isNaN(end)) return 'unknown'
    if (now < start) return 'not_started'
    if (now >= start && now < end) return 'active'
    return 'ended'
  }, [poll.startsAt, poll.endsAt, currentTime])

  const isPollEnded = pollStatus === 'ended'
  const isPollNotStarted = pollStatus === 'not_started'
  const isPollActive = pollStatus === 'active'

  const voteContestant = async () => {
    try {
      // Store poll ID for navigation
      const pollIdToShow = poll.id
      
      const tx: any = await toast.promise(voteCandidate(poll.id, contestant.id), {
        pending: 'Approving transaction...',
        success: {
          render({ data }: any) {
            const hash = data?.hash || data?.transactionHash || ''
            const explorerUrl = data?.explorerUrl || ''
            const handleDashboardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault()
              // Store poll ID in sessionStorage so dashboard can load it
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('selectedPollId', pollIdToShow.toString())
                window.location.href = '/user-dashboard'
              }
            }
            return (
              <div>
                <p>Voted contestant successfully!</p>
                {hash && (
                  <p className="text-xs mt-1">
                    TX: <a 
                      href="/user-dashboard" 
                      onClick={handleDashboardClick}
                      className="text-blue-400 underline hover:text-blue-300 cursor-pointer"
                    >
                      {hash.substring(0, 10)}...{hash.substring(hash.length - 8)}
                    </a>
                  </p>
                )}
              </div>
            )
          },
        },
        error: {
          render({ data }) {
            return (data as Error)?.message || 'Encountered error!'
          },
        },
      })

      if (tx?.hash) {
        console.log('📝 Transaction Hash:', tx.hash)
        if (tx.explorerUrl) {
          console.log('🔗 View on Explorer:', tx.explorerUrl)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Encountered error!'
      toast.error(message)
      console.error('voteContestant failed', error)
    }
  }

  return (
    <div className="flex justify-start items-center space-x-2 md:space-x-8 mt-5 md:mx-auto">
      <div className="w-[187px] sm:w-[324px] h-[229px] sm:h-[180px] rounded-[24px] overflow-hidden">
        <Image
          className="w-full h-full object-cover"
          width={3000}
          height={500}
          src={contestant.image}
          alt={contestant.name}
        />
      </div>

      <div
        className="bg-[#151515] h-[229px] w-[186px] sm:w-[253px] sm:h-fit rounded-[24px]
        space-y-2 flex justify-center items-center flex-col pt-2 pb-2 px-3"
      >
        <div className="flex w-full items-center justify-between">
          <h1 className="text-[16px] sm:text-[20px] font-[600px]">{contestant.name}</h1>
          {(canEdit || canDelete) && (
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={() => onEdit(contestant)}
                  title="Edit contestant"
                  className="rounded-full bg-[#0E1933] p-1 text-[#1B5CFE]"
                >
                  <MdEdit size={16} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(contestant)}
                  title="Delete contestant"
                  className="rounded-full bg-[#330E0E] p-1 text-[#FE6B6B]"
                >
                  <MdDelete size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-center w-full
          rounded-[10px] space-x-2"
        >
          <div className="w-[32px] h-[32px] rounded-full bg-[#2C2C2C]" />
          <p className="text-[14px] font-[500px]">
            {truncate({ text: contestant.voter, startChars: 4, endChars: 4, maxLength: 11 })}
          </p>
        </div>

        <button
          onClick={voteContestant}
          disabled={!walletAddress || hasVoted || isPollEnded || isPollNotStarted}
          className={`w-[158px] sm:w-[213px] h-[48px] rounded-[30.5px] ${
            !walletAddress || hasVoted || isPollEnded || isPollNotStarted ? 'bg-[#B0BAC9] cursor-not-allowed' : 'bg-[#1B5CFE] hover:bg-[#1a4fe0]'
          }`}
        >
          {votedForThisContestant ? 'Voted' : 'Vote'}
        </button>

        {isAdmin && (
          <div className="w-[86px] h-[32px] flex items-center justify-center gap-3">
            <div className="w-[32px] h-[32px] rounded-[9px] py-[8px] px-[9px] bg-[#0E1933]">
              <BiUpvote size={20} className="text-[#1B5CFE]" />
            </div>
            <p className="text-[14px] font-[600px]">
              {contestant.votes} {contestant.votes === 1 ? 'vote' : 'votes'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Contestants
