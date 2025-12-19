import Navbar from '@/components/Navbar'
import { RootState, PollStruct, ContestantStruct } from '@/utils/types'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getContestants, getPolls, getPoll } from '@/services/blockchain'
import { globalActions } from '@/store/globalSlices'
import { truncate, formatDate } from '@/utils/helper'
import { MdDelete } from 'react-icons/md'
import { BsTrash3Fill } from 'react-icons/bs'
import { FaTimes } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { useAdmin } from '@/hooks/useAdmin'

interface UserVote {
  poll: PollStruct
  contestant: ContestantStruct
}

const UserDashboard = () => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { setPolls, setPoll, setContestants } = globalActions
  const { wallet, poll, contestants, polls } = useSelector(
    (states: RootState) => states.globalStates
  )
  const isAdmin = useAdmin(wallet)
  const [allUserVotes, setAllUserVotes] = React.useState<UserVote[]>([])
  const [allPolls, setAllPolls] = React.useState<PollStruct[]>([])
  const [loadingVotes, setLoadingVotes] = React.useState(false)
  const [pollTransactions, setPollTransactions] = React.useState<Record<number, any>>({})
  const [pollWinners, setPollWinners] = React.useState<Record<number, { winner: ContestantStruct | null; isTie: boolean }>>({})
  const [deleteHistoryModal, setDeleteHistoryModal] = React.useState<'scale-0' | 'scale-100'>('scale-0')
  const [pollToDelete, setPollToDelete] = React.useState<PollStruct | null>(null)
  const [fetchedContestants, setFetchedContestants] = React.useState<Record<number, ContestantStruct>>({})
  const [loadingContestants, setLoadingContestants] = React.useState<Record<number, boolean>>({})

  // One-time cleanup: Remove all archived polls that user hasn't voted in
  React.useEffect(() => {
    if (typeof window === 'undefined' || !wallet) return
    
    try {
      const archivedPolls = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
      if (Array.isArray(archivedPolls) && archivedPolls.length > 0) {
        const address = wallet.toLowerCase()
        // Only keep archived polls where user has voted
        const relevantArchived = archivedPolls.filter((p: PollStruct) => 
          p.voters?.map((v) => v.toLowerCase()).includes(address)
        )
        // Clear localStorage and only keep relevant polls
        localStorage.setItem('archivedPolls', JSON.stringify(relevantArchived))
      }
    } catch {
      // ignore parse errors
    }
  }, [wallet])

  // Clear poll on mount to ensure main dashboard view is shown (unless coming from vote toast)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Only clear poll if there's no selectedPollId in sessionStorage (vote toast link)
    const selectedPollId = sessionStorage.getItem('selectedPollId')
    if (!selectedPollId) {
      // Clear poll and contestants to show main dashboard view
      dispatch(setPoll(null))
      dispatch(setContestants([]))
    }
  }, [dispatch, setPoll, setContestants])

  // Check for selected poll from sessionStorage (e.g., from vote toast link)
  React.useEffect(() => {
    const loadSelectedPoll = async () => {
      if (typeof window === 'undefined') return
      
      const selectedPollId = sessionStorage.getItem('selectedPollId')
      if (selectedPollId) {
        try {
          const pollId = Number(selectedPollId)
          const selectedPoll = await getPoll(pollId)
          const pollContestants = await getContestants(pollId)
          
          dispatch(setPoll(selectedPoll))
          dispatch(setContestants(pollContestants))
          
          // Clear sessionStorage after loading
          sessionStorage.removeItem('selectedPollId')
        } catch (error) {
          console.error('Error loading selected poll:', error)
          sessionStorage.removeItem('selectedPollId')
        }
      }
    }
    loadSelectedPoll()
  }, [dispatch, setPoll, setContestants])

  // Fetch polls if not available in Redux, or refresh on mount to ensure latest data
  React.useEffect(() => {
    const fetchPolls = async () => {
      try {
        // Always refresh polls to get latest voting status
        const pollsData = await getPolls()

        // Detect deleted polls and archive them if user voted
        if (typeof window !== 'undefined' && wallet) {
          try {
            const address = wallet.toLowerCase()
            
            // Get previous polls list to detect deletions
            const previousPollsStr = localStorage.getItem('previousPolls')
            let previousPolls: PollStruct[] = []
            if (previousPollsStr) {
              try {
                previousPolls = JSON.parse(previousPollsStr)
              } catch {
                previousPolls = []
              }
            }

            // Find polls that were in previous list but not in current list (deleted)
            const currentPollIds = new Set(pollsData.map(p => p.id))
            const deletedPolls = previousPolls.filter(p => 
              !currentPollIds.has(p.id) && 
              p.voters?.map((v) => v.toLowerCase()).includes(address)
            )

            // Archive deleted polls that user voted in
            if (deletedPolls.length > 0) {
              const existingArchived = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
              const existingArchivedIds = new Set(existingArchived.map((p: PollStruct) => p.id))
              const newArchived = deletedPolls.filter(p => !existingArchivedIds.has(p.id))
              
              if (newArchived.length > 0) {
                // Try to fetch latest poll data before archiving (to get correct endsAt)
                const archivedWithLatestData = await Promise.all(
                  newArchived.map(async (poll) => {
                    try {
                      const latestPoll = await getPoll(poll.id)
                      return latestPoll
                    } catch {
                      // If can't fetch, use stored poll data
                      return poll
                    }
                  })
                )
                
                localStorage.setItem('archivedPolls', JSON.stringify([...existingArchived, ...archivedWithLatestData]))
                
                // CRITICAL: Ensure vote records are preserved for deleted polls
                // Fetch contestants and create vote records if they don't exist
                const voteRecordsKey = `userVoteRecords_${address}`
                const existingVoteRecords = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
                const existingVoteRecordIds = new Set(existingVoteRecords.map((v: UserVote) => v.poll?.id))
                
                for (const deletedPoll of newArchived) {
                  // Only create vote record if user voted and record doesn't exist
                  const hasVoted = deletedPoll.voters?.map((v) => v.toLowerCase()).includes(address)
                  if (hasVoted && !existingVoteRecordIds.has(deletedPoll.id)) {
                    try {
                      // Try to fetch contestants to find which one user voted for
                      const pollContestants = await getContestants(deletedPoll.id)
                      const votedContestant = pollContestants.find((c) =>
                        c.voters?.map((v) => v.toLowerCase()).includes(address)
                      )
                      
                      if (votedContestant) {
                        // Create vote record for deleted poll
                        const voteRecord: UserVote = {
                          poll: deletedPoll,
                          contestant: votedContestant
                        }
                        existingVoteRecords.push(voteRecord)
                        existingVoteRecordIds.add(deletedPoll.id)
                      }
                    } catch (error) {
                      console.error(`Error creating vote record for deleted poll ${deletedPoll.id}:`, error)
                    }
                  }
                }
                
                // Update localStorage with preserved vote records
                if (existingVoteRecords.length > 0) {
                  localStorage.setItem(voteRecordsKey, JSON.stringify(existingVoteRecords))
                }
              }
            }

            // Update previous polls list for next comparison
            localStorage.setItem('previousPolls', JSON.stringify(pollsData))
          } catch (error) {
            console.error('Error detecting/archiving deleted polls:', error)
          }
        }

        // Only keep archived polls if user has voted in them (for voting history)
        let archivedPolls: PollStruct[] = []
        if (typeof window !== 'undefined' && wallet) {
          try {
            const storedArchived = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
            const address = wallet.toLowerCase()
            // Filter to only keep archived polls where user has voted
            archivedPolls = storedArchived.filter((p: PollStruct) => 
              p.voters?.map((v) => v.toLowerCase()).includes(address)
            )
            // Update localStorage to only keep relevant archived polls
            localStorage.setItem('archivedPolls', JSON.stringify(archivedPolls))
          } catch {
            archivedPolls = []
          }
        }
        
        const existingIds = new Set(pollsData.map((p) => p.id))
        // Only merge archived polls that user has voted in
        const mergedPolls = [...pollsData, ...archivedPolls.filter((p) => !existingIds.has(p.id))]

        // Keep global store with live on-chain polls only (prevents deleted polls reappearing elsewhere)
        dispatch(setPolls(pollsData))

        // Local dashboard view uses only live polls (archived polls will be shown in Voted History)
        setAllPolls(pollsData)
      } catch (error) {
        console.error('Error fetching polls:', error)
      }
    }
    fetchPolls()
  }, [dispatch, setPolls, wallet])

  // Clear old archived polls that user hasn't voted in
  React.useEffect(() => {
    if (typeof window === 'undefined' || !wallet) return
    try {
      const archivedPolls = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
      if (Array.isArray(archivedPolls) && archivedPolls.length > 0) {
        const address = wallet.toLowerCase()
        // Only keep archived polls where user has voted
        const relevantArchived = archivedPolls.filter((p: PollStruct) => 
          p.voters?.map((v) => v.toLowerCase()).includes(address)
        )
        // Update localStorage to remove irrelevant archived polls
        localStorage.setItem('archivedPolls', JSON.stringify(relevantArchived))
      }
    } catch {
      // ignore parse errors
    }
  }, [wallet])


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

  // Fetch all user votes across all polls (including archived polls user voted in)
  React.useEffect(() => {
    const fetchAllUserVotes = async () => {
      if (!wallet) {
        setAllUserVotes([])
        return
      }

      setLoadingVotes(true)
      const address = wallet.toLowerCase()
      const votes: UserVote[] = []

      try {
        // Get list of deleted poll IDs that THIS WALLET has manually deleted from history
        // Use wallet-specific storage so admin deletions don't affect user accounts
        const deletedPollIds: number[] = []
        if (typeof window !== 'undefined') {
          try {
            const deletedKey = `deletedVoteHistoryIds_${address}`
            const deletedIds = JSON.parse(localStorage.getItem(deletedKey) || '[]')
            deletedPollIds.push(...deletedIds)
          } catch {
            // ignore
          }
        }

        // First, load stored vote records from localStorage (for deleted polls)
        // These are the PRIMARY source for deleted polls - always include them
        // Don't filter by voters array - if it's stored, the user voted
        // BUT exclude polls that THIS WALLET has manually deleted from history
        // Use wallet-specific storage so each account has its own vote history
        let storedVotes: UserVote[] = []
        if (typeof window !== 'undefined') {
          try {
            const voteRecordsKey = `userVoteRecords_${address}`
            const stored = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
            // Include all stored votes - they represent votes the user has made
            // Don't filter by voters array as deleted polls might not have this data
            // Exclude polls that THIS WALLET has manually deleted from history
            storedVotes = stored.filter((v: UserVote) => 
              v && v.poll && v.poll.id && v.contestant && v.contestant.id && !deletedPollIds.includes(v.poll.id)
            )
          } catch {
            storedVotes = []
          }
        }

        // Get archived polls from localStorage (only those user voted in)
        let archivedPolls: PollStruct[] = []
        if (typeof window !== 'undefined') {
          try {
            const storedArchived = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
            archivedPolls = storedArchived.filter((p: PollStruct) => 
              p.voters?.map((v) => v.toLowerCase()).includes(address)
            )
          } catch {
            archivedPolls = []
          }
        }

        // Track which polls we've already processed
        const processedPollIds = new Set<number>()

        // PRIORITY 1: Add stored votes first (these include deleted polls)
        // This ensures deleted polls are ALWAYS shown in Voted History
        // CRITICAL: Always include stored votes, even if poll is deleted
        for (const storedVote of storedVotes) {
          if (!processedPollIds.has(storedVote.poll.id)) {
            // Try to fetch latest poll data even for deleted polls to get correct endsAt
            // getPoll() can still fetch deleted polls from blockchain
            try {
              const fetchedPoll = await getPoll(storedVote.poll.id)
              // Update stored vote with latest poll data (even if deleted)
              votes.push({
                poll: fetchedPoll, // Use latest poll data with correct endsAt
                contestant: storedVote.contestant,
              })
            } catch (error) {
              // If truly deleted and can't fetch, use stored vote as-is
              // This ensures deleted polls still show in Voted History
              // IMPORTANT: Always include stored votes, don't skip them
              votes.push(storedVote)
            }
            processedPollIds.add(storedVote.poll.id)
          }
        }

        // PRIORITY 3: Check current polls and archived polls
        // Combine current polls with archived polls user voted in
        // BUT exclude polls that user has manually deleted from history
        const allPollsToCheck = [...allPolls, ...archivedPolls.filter((p) => 
          !allPolls.some((ap) => ap.id === p.id) && !deletedPollIds.includes(p.id)
        )]

        // Check each poll to see if user voted (only if not already processed from stored votes)
        for (const currentPoll of allPollsToCheck) {
          if (processedPollIds.has(currentPoll.id)) {
            continue // Already processed from stored votes
          }
          
          // Skip if user has manually deleted this poll from history
          if (deletedPollIds.includes(currentPoll.id)) {
            continue
          }

          const hasVoted = currentPoll.voters?.map((v) => v.toLowerCase()).includes(address)
          
          if (hasVoted) {
            try {
              // Try to fetch latest poll data from blockchain to get correct endsAt
              let latestPoll = currentPoll
              try {
                const fetchedPoll = await getPoll(currentPoll.id)
                // Use fetched poll data if available (has correct endsAt even if deleted)
                latestPoll = fetchedPoll
              } catch {
                // If poll is truly deleted, use stored poll data
                latestPoll = currentPoll
              }

              // Fetch contestants for this poll
              const pollContestants = await getContestants(currentPoll.id)
              
              // Find which contestant the user voted for
              const votedContestant = pollContestants.find((c) =>
                c.voters?.map((v) => v.toLowerCase()).includes(address)
              )

              if (votedContestant) {
                votes.push({
                  poll: latestPoll, // Use latest poll data with correct endsAt
                  contestant: votedContestant,
                })
                processedPollIds.add(currentPoll.id)
              }
            } catch (error) {
              // Poll might be deleted, use stored vote record if available
              const storedVote = storedVotes.find((v) => v.poll.id === currentPoll.id)
              if (storedVote) {
                // Try to fetch latest poll data even for deleted polls
                try {
                  const fetchedPoll = await getPoll(currentPoll.id)
                  // Update stored vote with latest poll data
                  votes.push({
                    poll: fetchedPoll,
                    contestant: storedVote.contestant,
                  })
                } catch {
                  // If truly deleted, use stored vote as-is
                  votes.push(storedVote)
                }
                processedPollIds.add(currentPoll.id)
              }
            }
          }
        }


        // Update localStorage with current votes (includes deleted polls)
        // CRITICAL: Always preserve ALL stored votes, including deleted polls
        // The votes array already includes stored votes from PRIORITY 1, so we just need to ensure
        // we don't lose any stored votes that might not have been processed
        if (typeof window !== 'undefined') {
          try {
            // Get existing stored votes - use wallet-specific storage
            const voteRecordsKey = `userVoteRecords_${address}`
            const existingStored = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
            const existingIds = new Set(votes.map(v => v.poll.id))
            
            // Add any stored votes that aren't in current votes (deleted polls that weren't processed)
            // BUT exclude polls that THIS WALLET has manually deleted from history
            const missingStoredVotes = existingStored.filter((v: UserVote) => 
              v && v.poll && v.poll.id && 
              !existingIds.has(v.poll.id) && 
              !deletedPollIds.includes(v.poll.id)
            )
            
            // Filter out manually deleted polls from current votes
            const filteredVotes = votes.filter(v => !deletedPollIds.includes(v.poll.id))
            
            // Merge: current votes + missing stored votes (excluding manually deleted ones)
            // This ensures we never lose vote records, even for deleted polls
            const allVotes = [...filteredVotes, ...missingStoredVotes]
            
            // Store merged votes (excluding manually deleted ones) - use wallet-specific storage
            // CRITICAL: Always preserve all vote records, never overwrite with empty array
            localStorage.setItem(voteRecordsKey, JSON.stringify(allVotes))
            
            // Set state with all votes (excluding manually deleted polls)
            setAllUserVotes(allVotes)
          } catch (error) {
            console.error('Error updating stored votes:', error)
            // Fallback: preserve existing stored votes if update fails
            try {
              const voteRecordsKey = `userVoteRecords_${address}`
              const existingStored = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
              const filteredStored = existingStored.filter((v: UserVote) => 
                v && v.poll && v.poll.id && !deletedPollIds.includes(v.poll.id)
              )
              // Use stored votes as fallback to preserve deleted poll votes
              setAllUserVotes([...votes.filter(v => !deletedPollIds.includes(v.poll.id)), ...filteredStored])
            } catch {
              // Last resort: just use current votes (excluding manually deleted ones)
              const filteredVotes = votes.filter(v => !deletedPollIds.includes(v.poll.id))
              setAllUserVotes(filteredVotes)
            }
          }
        } else {
          setAllUserVotes(votes)
        }
      } catch (error) {
        console.error('Error fetching user votes:', error)
      } finally {
        setLoadingVotes(false)
      }
    }

    fetchAllUserVotes()
  }, [wallet, allPolls])

  // Fetch transaction details for polls that have been voted on (including archived polls)
  React.useEffect(() => {
    const fetchTransactions = async () => {
      if (!wallet) return

      const address = wallet.toLowerCase()
      const transactions: Record<number, any> = {}

      // Get archived polls user voted in
      let archivedPolls: PollStruct[] = []
      if (typeof window !== 'undefined') {
        try {
          const storedArchived = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
          archivedPolls = storedArchived.filter((p: PollStruct) => 
            p.voters?.map((v) => v.toLowerCase()).includes(address)
          )
        } catch {
          archivedPolls = []
        }
      }

      // Combine current polls with archived polls
      const allPollsToCheck = [...allPolls, ...archivedPolls.filter((p) => 
        !allPolls.some((ap) => ap.id === p.id)
      )]

      for (const currentPoll of allPollsToCheck) {
        const hasVoted = currentPoll.voters?.map((v) => v.toLowerCase()).includes(address)
        if (hasVoted) {
          try {
            const response = await fetch(`/api/votes/get-transactions?pollId=${currentPoll.id}&voterAddress=${address}`)
            const data = await response.json()
            if (response.ok && data.transactions && data.transactions.length > 0) {
              transactions[currentPoll.id] = data.transactions[0] // Get the most recent transaction
            }
          } catch (error) {
            console.error(`Error fetching transaction for poll ${currentPoll.id}:`, error)
          }
        }
      }

      setPollTransactions(transactions)
    }

    fetchTransactions()
  }, [wallet, allPolls])

  // Function to fetch contestant info for a poll when user has voted but entry is missing
  const fetchContestantForPoll = React.useCallback(async (pollId: number) => {
    if (!wallet) return
    
    // Set loading state (functional update ensures we don't overwrite concurrent updates)
    setLoadingContestants(prev => {
      if (prev[pollId]) return prev // Already loading, skip
      return { ...prev, [pollId]: true }
    })
    
    try {
      // Fetch both poll and contestants
      const [pollData, pollContestants] = await Promise.all([
        getPoll(pollId).catch(() => null),
        getContestants(pollId)
      ])
      
      const address = wallet.toLowerCase()
      const votedContestant = pollContestants.find((c) =>
        c.voters?.map((v) => v.toLowerCase()).includes(address)
      )
      
      if (votedContestant) {
        // Store in fetchedContestants for immediate display
        setFetchedContestants(prev => {
          // Only set if not already set (handles race conditions)
          if (prev[pollId]) return prev
          return { ...prev, [pollId]: votedContestant }
        })
        
        // Use pollData if available, otherwise try to get from stored votes
        let pollToUse = pollData
        if (!pollToUse && typeof window !== 'undefined') {
          try {
            const voteRecordsKey = `userVoteRecords_${address}`
            const existingStored = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
            const storedVote = existingStored.find((v: UserVote) => v.poll?.id === pollId)
            if (storedVote && storedVote.poll) {
              pollToUse = storedVote.poll
            }
          } catch (error) {
            console.error('Error getting stored poll data:', error)
          }
        }
        
        // Only proceed if we have poll data (either fetched or stored)
        if (pollToUse) {
          // Also add to allUserVotes so it appears in Voted History
          const voteEntry: UserVote = {
            poll: pollToUse,
            contestant: votedContestant
          }
          
          setAllUserVotes(prev => {
            // Check if already exists
            if (prev.some(v => v.poll.id === pollId)) return prev
            return [...prev, voteEntry]
          })
          
          // Store in localStorage for persistence
          if (typeof window !== 'undefined') {
            try {
              const voteRecordsKey = `userVoteRecords_${address}`
              const existingStored = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
              const existingIndex = existingStored.findIndex((v: UserVote) => v.poll?.id === pollId)
              
              if (existingIndex >= 0) {
                // Update existing record
                existingStored[existingIndex] = voteEntry
              } else {
                // Add new record
                existingStored.push(voteEntry)
              }
              
              localStorage.setItem(voteRecordsKey, JSON.stringify(existingStored))
            } catch (error) {
              console.error('Error storing vote record in localStorage:', error)
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching contestant for poll ${pollId}:`, error)
    } finally {
      setLoadingContestants(prev => {
        const newState = { ...prev }
        delete newState[pollId]
        return newState
      })
    }
  }, [wallet])

  // Fetch contestant info for polls where user has voted but entry is missing
  React.useEffect(() => {
    if (!wallet) return
    
    const address = wallet.toLowerCase()
    
    // Check stored votes for polls that might be deleted (not in allPolls)
    // This ensures deleted polls are still processed
    if (typeof window !== 'undefined') {
      try {
        const voteRecordsKey = `userVoteRecords_${address}`
        const storedVotes = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
        
        // Find stored votes for polls not in allPolls (likely deleted)
        const deletedPollVotes = storedVotes.filter((v: UserVote) => {
          if (!v || !v.poll || !v.poll.id) return false
          const inAllPolls = allPolls.some(p => p.id === v.poll.id)
          const hasEntry = allUserVotes.some(uv => uv.poll.id === v.poll.id)
          const hasFetched = fetchedContestants[v.poll.id]
          const isLoading = loadingContestants[v.poll.id]
          return !inAllPolls && !hasEntry && !hasFetched && !isLoading
        })
        
        // Fetch contestant info for deleted polls
        deletedPollVotes.forEach((vote: UserVote) => {
          fetchContestantForPoll(vote.poll.id)
        })
      } catch (error) {
        console.error('Error checking stored votes for deleted polls:', error)
      }
    }
    
    // Check current polls (non-deleted)
    if (allPolls.length > 0) {
      const pollsToFetch = allPolls.filter(p => {
        if (p.deleted) return false // Skip deleted polls (handled above)
        const hasVoted = p.voters?.map((v) => v.toLowerCase()).includes(address)
        const votedEntry = allUserVotes.find(v => v.poll.id === p.id)
        const fetchedContestant = fetchedContestants[p.id]
        const isLoading = loadingContestants[p.id]
        return hasVoted && !votedEntry && !fetchedContestant && !isLoading
      })
      
      pollsToFetch.forEach(poll => {
        fetchContestantForPoll(poll.id)
      })
    }
  }, [wallet, allPolls, allUserVotes, fetchedContestants, loadingContestants, fetchContestantForPoll])

  // Fetch winners for ended polls (including archived/deleted polls and voted history polls)
  React.useEffect(() => {
    const fetchWinners = async () => {
      // Don't load stored winners - always fetch fresh from blockchain to ensure accuracy
      // Stored winners can become stale if votes are added after the poll ends
      const storedWinners: Record<number, { winner: ContestantStruct | null; isTie: boolean }> = {}

      // Get archived polls from localStorage (for deleted polls)
      let archivedPolls: PollStruct[] = []
      if (typeof window !== 'undefined') {
        try {
          const storedArchived = JSON.parse(localStorage.getItem('archivedPolls') || '[]')
          archivedPolls = storedArchived
        } catch {
          archivedPolls = []
        }
      }

      // Get polls from user votes (for Voted History)
      const votedHistoryPolls = allUserVotes.map(v => v.poll)

      // Combine current polls with archived polls and voted history polls
      const allPollsToCheck = [
        ...allPolls, 
        ...archivedPolls.filter((p) => !allPolls.some((ap) => ap.id === p.id)),
        ...votedHistoryPolls.filter((p) => !allPolls.some((ap) => ap.id === p.id) && !archivedPolls.some((ap) => ap.id === p.id))
      ]

      if (allPollsToCheck.length === 0) {
        // If no polls to check, use stored winners
        setPollWinners(storedWinners)
        return
      }

      const winners: Record<number, { winner: ContestantStruct | null; isTie: boolean }> = { ...storedWinners }

      for (const currentPoll of allPollsToCheck) {
        const now = Date.now()
        // Handle both string and number formats for timestamps
        const end = typeof currentPoll.endsAt === 'string' 
          ? new Date(currentPoll.endsAt).getTime() 
          : Number(currentPoll.endsAt)
        
        // Only fetch winners for ended polls
        if (end && !isNaN(end) && now >= end) {
          // Always fetch fresh winner data from blockchain to ensure accuracy
          // Don't skip even if we have a stored winner, as vote counts may have changed
          try {
            // Try to fetch contestants even for deleted polls (contract allows this)
            const pollContestants = await getContestants(currentPoll.id)
            
            if (pollContestants.length > 0) {
              const maxVotes = Math.max(...pollContestants.map(c => Number(c.votes) || 0))
              const winnersWithMaxVotes = pollContestants.filter(c => (Number(c.votes) || 0) === maxVotes)
              
              const isTie = winnersWithMaxVotes.length > 1
              const winner = isTie ? null : (winnersWithMaxVotes[0] || null)
              
              winners[currentPoll.id] = { winner, isTie }
            } else {
              // No contestants found, mark as no votes
              winners[currentPoll.id] = { winner: null, isTie: false }
            }
          } catch (error) {
            // Poll might be deleted and contestants not accessible
            // Use stored winner if available, otherwise mark as unknown
            console.error(`Error fetching contestants for poll ${currentPoll.id}:`, error)
            if (!winners[currentPoll.id]) {
              // If no stored winner, we can't determine the winner
              // Leave it undefined so it shows "Loading winner..."
            }
          }
        }
      }

      // Store winners in localStorage for future use (especially for deleted polls)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('pollWinners', JSON.stringify(winners))
        } catch {
          // Ignore storage errors
        }
      }

      setPollWinners(winners)
    }

    fetchWinners()
  }, [allPolls, allUserVotes])

  const userStatus = React.useMemo(() => {
    if (!poll || !wallet) return 'Connect wallet to see your status'
    const address = wallet.toLowerCase()

    const hasVoted = poll.voters?.map((v) => v.toLowerCase()).includes(address)
    if (!hasVoted) {
      if (votingStatus === 'Ended') {
        return 'Election ended — you did not vote in this poll.'
      }
      if (votingStatus === 'Active') {
        return 'You have not voted yet. You can still vote while the election is active.'
      }
      return 'Voting has not started yet.'
    }

    const votedContestant = contestants.find((c) =>
      c.voters?.map((v) => v.toLowerCase()).includes(address)
    )

    if (votedContestant) {
      return `You voted for ${votedContestant.name}.`
    }

    return 'Your vote was recorded in this poll.'
  }, [poll, contestants, wallet, votingStatus])

  // Filter out deleted polls - only show existing polls
  const existingPolls = React.useMemo(() => {
    return allPolls.filter((p) => !p.deleted)
  }, [allPolls])

  // If no poll is selected, show only the all votes section
  if (!poll) {
    return (
      <>
        <Head>
          <title>Your Voting Dashboard</title>
        </Head>
        <div className="min-h-screen relative backdrop-blur text-white">
          <div
            className="absolute inset-0 before:absolute before:inset-0
            before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
            before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
          />
          <section className="relative px-5 py-10 space-y-10 sm:p-10">
            <Navbar />
            
            {/* All Polls Section */}
            <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6 space-y-4">
              <h1 className="text-2xl font-semibold">All Polls</h1>
              {loadingVotes ? (
                <p className="text-sm text-[#B0BAC9]">Loading polls...</p>
              ) : !wallet ? (
                <p className="text-sm text-[#B0BAC9]">Connect wallet to see your polls.</p>
              ) : existingPolls.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-[#B0BAC9]">No polls available.</p>
                  <button
                    onClick={() => router.push('/')}
                    className="rounded-[30.5px] bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1a4fe0] transition-colors"
                  >
                    Go to polls
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {existingPolls.map((currentPoll, index) => {
                    const address = wallet.toLowerCase()
                    const hasVoted = currentPoll.voters?.map((v) => v.toLowerCase()).includes(address)
                    const votedEntry = allUserVotes.find(v => v.poll.id === currentPoll.id)
                    const fetchedContestant = fetchedContestants[currentPoll.id]
                    
                    // Determine which contestant to show
                    const displayContestant = votedEntry?.contestant || fetchedContestant
                    const showVotedInfo = hasVoted && displayContestant
                    
                    const pollStatus = (() => {
                      const now = Date.now()
                      const start = Number(currentPoll.startsAt)
                      const end = Number(currentPoll.endsAt)
                      if (!start || !end) return 'Unknown'
                      if (now < start) return 'Not started'
                      if (now >= start && now < end) return 'Active'
                      return 'Ended'
                    })()

                    return (
                      <div
                        key={currentPoll.id}
                        className="rounded-2xl bg-[#0E0E0E] border border-[#2C2C2C] p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">
                              {index + 1}. {currentPoll.title}
                            </p>
                            {showVotedInfo ? (
                              <>
                                <p className="text-xs text-[#B0BAC9] mt-1">
                                  You voted for: <span className="font-semibold text-white">{displayContestant.name}</span>
                                </p>
                                <p className="text-xs text-[#B0BAC9] mt-1">
                                  Status: <span className="font-semibold text-white">{pollStatus}</span>
                                </p>
                                {pollTransactions[currentPoll.id] && (
                                  <div className="mt-2 p-2 bg-[#0E0E0E] rounded-lg border border-[#2C2C2C] space-y-1">
                                    <p className="text-xs text-[#B0BAC9]">
                                      <span className="font-semibold">TX Hash:</span>{' '}
                                      <span className="text-white font-mono">
                                        {truncate({ text: pollTransactions[currentPoll.id].transaction_hash, startChars: 8, endChars: 8, maxLength: 20 })}
                                      </span>
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <p className="text-[#B0BAC9]">
                                        <span className="font-semibold">From:</span>{' '}
                                        <span className="text-white font-mono">
                                          {truncate({ text: pollTransactions[currentPoll.id].from_address || '', startChars: 6, endChars: 4, maxLength: 14 })}
                                        </span>
                                      </p>
                                      <p className="text-[#B0BAC9]">
                                        <span className="font-semibold">To:</span>{' '}
                                        <span className="text-white font-mono">
                                          {truncate({ text: pollTransactions[currentPoll.id].to_address || '', startChars: 6, endChars: 4, maxLength: 14 })}
                                        </span>
                                      </p>
                                    </div>
                                    {pollTransactions[currentPoll.id].transaction_timestamp && (
                                      <p className="text-xs text-[#B0BAC9]">
                                        <span className="font-semibold">Time:</span>{' '}
                                        <span className="text-white">
                                          {formatDate(new Date(pollTransactions[currentPoll.id].transaction_timestamp).getTime())}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                {pollStatus === 'Ended' && pollWinners[currentPoll.id] && (
                                  <div className="mt-2 p-2 bg-[#0E1933] rounded-lg border border-[#1B5CFE] space-y-1">
                                    <p className="text-xs text-[#B0BAC9]">
                                      <span className="font-semibold">Winner:</span>{' '}
                                      {pollWinners[currentPoll.id].isTie ? (
                                        <span className="text-white font-semibold">Tie (Nobody win)</span>
                                      ) : pollWinners[currentPoll.id].winner ? (
                                        <>
                                          <span className="text-white font-semibold">{pollWinners[currentPoll.id].winner?.name}</span>
                                          {isAdmin && (
                                            <span className="text-[#B0BAC9] ml-1">
                                              ({pollWinners[currentPoll.id].winner?.votes} {pollWinners[currentPoll.id].winner?.votes === 1 ? 'vote' : 'votes'})
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-white">No votes cast</span>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-[#B0BAC9] mt-1">
                                  {pollStatus === 'Active' 
                                    ? 'You have not voted yet. You can still vote while the election is active.'
                                    : pollStatus === 'Ended'
                                    ? 'Election ended — you did not vote in this poll.'
                                    : 'Voting has not started yet.'}
                                </p>
                                <p className="text-xs text-[#B0BAC9] mt-1">
                                  Status: <span className="font-semibold text-white">{pollStatus}</span>
                                </p>
                                {pollStatus === 'Ended' && pollWinners[currentPoll.id] && (
                                  <div className="mt-2 p-2 bg-[#0E1933] rounded-lg border border-[#1B5CFE] space-y-1">
                                    <p className="text-xs text-[#B0BAC9]">
                                      <span className="font-semibold">Winner:</span>{' '}
                                      {pollWinners[currentPoll.id].isTie ? (
                                        <span className="text-white font-semibold">Tie (Nobody win)</span>
                                      ) : pollWinners[currentPoll.id].winner ? (
                                        <>
                                          <span className="text-white font-semibold">{pollWinners[currentPoll.id].winner?.name}</span>
                                          <span className="text-[#B0BAC9] ml-1">
                                            ({pollWinners[currentPoll.id].winner?.votes} {pollWinners[currentPoll.id].winner?.votes === 1 ? 'vote' : 'votes'})
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-white">No votes cast</span>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => router.push(`/polls/${currentPoll.id}`)}
                            className="rounded-[16px] bg-[#1B5CFE] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4fe0] transition-colors"
                          >
                            View Poll
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Delete Vote History Confirmation Modal */}
        <div
          className={`fixed top-0 left-0 w-screen h-screen flex items-center justify-center
          bg-black bg-opacity-50 transform z-50 transition-transform duration-300 ${deleteHistoryModal}`}
        >
          <div className="bg-[#0c0c10] text-[#BBBBBB] shadow-lg shadow-[#1B5CFE] rounded-xl w-11/12 md:w-2/5 h-7/12 p-6">
            <div className="flex flex-col">
              <div className="flex flex-row justify-between items-center">
                <p className="font-semibold">Delete Vote History</p>
                <button 
                  onClick={() => {
                    setDeleteHistoryModal('scale-0')
                    setPollToDelete(null)
                  }} 
                  className="border-0 bg-transparent focus:outline-none"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="flex flex-col justify-center items-center rounded-xl mt-5 mb-5">
                <div className="flex flex-col justify-center items-center rounded-xl my-5 space-y-2">
                  <BsTrash3Fill className="text-red-600" size={50} />
                  <h4 className="text-[22.65px]">Delete Vote History</h4>
                  <p className="text-[14px]">Are you sure you want to delete this vote history entry?</p>
                  <small className="text-xs italic">{pollToDelete?.title}</small>
                </div>

                <button
                  className="h-[48px] w-full block mt-2 px-3 rounded-full text-sm font-bold
                  transition-all duration-300 bg-red-600 hover:bg-red-500"
                  onClick={() => {
                    if (!pollToDelete || !wallet) return
                    
                    // Remove vote entry from localStorage (doesn't affect the actual poll)
                    // Use wallet-specific storage so admin deletions don't affect user accounts
                    if (typeof window !== 'undefined') {
                      try {
                        const address = wallet.toLowerCase()
                        const deletedKey = `deletedVoteHistoryIds_${address}`
                        const voteRecordsKey = `userVoteRecords_${address}`
                        
                        // Get list of deleted poll IDs to track what THIS WALLET has deleted
                        const deletedPollIds = JSON.parse(localStorage.getItem(deletedKey) || '[]')
                        if (!deletedPollIds.includes(pollToDelete.id)) {
                          deletedPollIds.push(pollToDelete.id)
                          localStorage.setItem(deletedKey, JSON.stringify(deletedPollIds))
                        }
                        
                        // Remove from THIS WALLET's userVoteRecords
                        const existingVotes = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
                        const updatedVotes = existingVotes.filter((v: UserVote) => v.poll.id !== pollToDelete.id)
                        localStorage.setItem(voteRecordsKey, JSON.stringify(updatedVotes))
                        
                        // Update state to remove from display
                        setAllUserVotes(prev => prev.filter(v => v.poll.id !== pollToDelete.id))
                        
                        // Close modal and clear poll
                        setDeleteHistoryModal('scale-0')
                        setPollToDelete(null)
                        
                        toast.success('Vote history entry deleted successfully')
                      } catch (error) {
                        console.error('Error deleting vote history:', error)
                        toast.error('Failed to delete vote history entry')
                      }
                    }
                  }}
                >
                  Delete Vote History
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Your Voting Dashboard | {poll.title}</title>
      </Head>
      <div className="min-h-screen relative backdrop-blur text-white">
        <div
          className="absolute inset-0 before:absolute before:inset-0
          before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
          before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 space-y-10 sm:p-10">
          <Navbar />

          <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Your voting status</h1>
            <p className="text-sm text-[#B0BAC9]">
              Poll: <span className="font-semibold text-white">{poll.title}</span>
            </p>
            <p className="text-sm text-[#B0BAC9]">
              Status:{' '}
              <span className="font-semibold text-white">
                {votingStatus}
              </span>
            </p>
            <p className="text-sm text-[#B0BAC9]">{userStatus}</p>
          </div>

          {/* All Polls Section */}
          <div className="bg-[#151515]/70 border border-[#2C2C2C] rounded-[24px] p-6 space-y-4">
            <h1 className="text-2xl font-semibold">All Polls</h1>
            {loadingVotes ? (
              <p className="text-sm text-[#B0BAC9]">Loading polls...</p>
            ) : !wallet ? (
              <p className="text-sm text-[#B0BAC9]">Connect wallet to see your polls.</p>
            ) : existingPolls.length === 0 ? (
              <p className="text-sm text-[#B0BAC9]">No polls available.</p>
            ) : (
              <div className="space-y-3">
                {existingPolls.map((currentPoll, index) => {
                  const address = wallet.toLowerCase()
                  const hasVoted = currentPoll.voters?.map((v) => v.toLowerCase()).includes(address)
                  const votedEntry = allUserVotes.find(v => v.poll.id === currentPoll.id)
                  const fetchedContestant = fetchedContestants[currentPoll.id]
                  
                  // Determine which contestant to show
                  const displayContestant = votedEntry?.contestant || fetchedContestant
                  const showVotedInfo = hasVoted && displayContestant
                  
                  const pollStatus = (() => {
                    const now = Date.now()
                    const start = Number(currentPoll.startsAt)
                    const end = Number(currentPoll.endsAt)
                    if (!start || !end) return 'Unknown'
                    if (now < start) return 'Not started'
                    if (now >= start && now < end) return 'Active'
                    return 'Ended'
                  })()

                  return (
                    <div
                      key={currentPoll.id}
                      className="rounded-2xl bg-[#0E0E0E] border border-[#2C2C2C] p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">
                            {index + 1}. {currentPoll.title}
                          </p>
                          {showVotedInfo ? (
                            <>
                              <p className="text-xs text-[#B0BAC9] mt-1">
                                You voted for: <span className="font-semibold text-white">{displayContestant.name}</span>
                              </p>
                              <p className="text-xs text-[#B0BAC9] mt-1">
                                Status: <span className="font-semibold text-white">{pollStatus}</span>
                              </p>
                              {pollTransactions[currentPoll.id] && (
                                <div className="mt-2 p-2 bg-[#0E0E0E] rounded-lg border border-[#2C2C2C] space-y-1">
                                  <p className="text-xs text-[#B0BAC9]">
                                    <span className="font-semibold">TX Hash:</span>{' '}
                                    <span className="text-white font-mono">
                                      {truncate({ text: pollTransactions[currentPoll.id].transaction_hash, startChars: 8, endChars: 8, maxLength: 20 })}
                                    </span>
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <p className="text-[#B0BAC9]">
                                      <span className="font-semibold">From:</span>{' '}
                                      <span className="text-white font-mono">
                                        {truncate({ text: pollTransactions[currentPoll.id].from_address || '', startChars: 6, endChars: 4, maxLength: 14 })}
                                      </span>
                                    </p>
                                    <p className="text-[#B0BAC9]">
                                      <span className="font-semibold">To:</span>{' '}
                                      <span className="text-white font-mono">
                                        {truncate({ text: pollTransactions[currentPoll.id].to_address || '', startChars: 6, endChars: 4, maxLength: 14 })}
                                      </span>
                                    </p>
                                  </div>
                                  {pollTransactions[currentPoll.id].transaction_timestamp && (
                                    <p className="text-xs text-[#B0BAC9]">
                                      <span className="font-semibold">Time:</span>{' '}
                                      <span className="text-white">
                                        {formatDate(new Date(pollTransactions[currentPoll.id].transaction_timestamp).getTime())}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              )}
                              {pollStatus === 'Ended' && pollWinners[currentPoll.id] && (
                                <div className="mt-2 p-2 bg-[#0E1933] rounded-lg border border-[#1B5CFE] space-y-1">
                                  <p className="text-xs text-[#B0BAC9]">
                                    <span className="font-semibold">Winner:</span>{' '}
                                    {pollWinners[currentPoll.id].isTie ? (
                                      <span className="text-white font-semibold">Tie (Nobody win)</span>
                                    ) : pollWinners[currentPoll.id].winner ? (
                                      <>
                                        <span className="text-white font-semibold">{pollWinners[currentPoll.id].winner?.name}</span>
                                        {isAdmin && (
                                          <span className="text-[#B0BAC9] ml-1">
                                            ({pollWinners[currentPoll.id].winner?.votes} {pollWinners[currentPoll.id].winner?.votes === 1 ? 'vote' : 'votes'})
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-white">No votes cast</span>
                                    )}
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-[#B0BAC9] mt-1">
                                {pollStatus === 'Active' 
                                  ? 'You have not voted yet. You can still vote while the election is active.'
                                  : pollStatus === 'Ended'
                                  ? 'Election ended — you did not vote in this poll.'
                                  : 'Voting has not started yet.'}
                              </p>
                                <p className="text-xs text-[#B0BAC9] mt-1">
                                  Status: <span className="font-semibold text-white">{pollStatus}</span>
                                </p>
                                {pollStatus === 'Ended' && pollWinners[currentPoll.id] && (
                                  <div className="mt-2 p-2 bg-[#0E1933] rounded-lg border border-[#1B5CFE] space-y-1">
                                    <p className="text-xs text-[#B0BAC9]">
                                      <span className="font-semibold">Winner:</span>{' '}
                                      {pollWinners[currentPoll.id].isTie ? (
                                        <span className="text-white font-semibold">Tie (Nobody win)</span>
                                      ) : pollWinners[currentPoll.id].winner ? (
                                        <>
                                          <span className="text-white font-semibold">{pollWinners[currentPoll.id].winner?.name}</span>
                                          <span className="text-[#B0BAC9] ml-1">
                                            ({pollWinners[currentPoll.id].winner?.votes} {pollWinners[currentPoll.id].winner?.votes === 1 ? 'vote' : 'votes'})
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-white">No votes cast</span>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => router.push(`/polls/${currentPoll.id}`)}
                            className="rounded-[16px] bg-[#1B5CFE] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4fe0] transition-colors"
                          >
                            View Poll
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Delete Vote History Confirmation Modal */}
        <div
          className={`fixed top-0 left-0 w-screen h-screen flex items-center justify-center
          bg-black bg-opacity-50 transform z-50 transition-transform duration-300 ${deleteHistoryModal}`}
        >
          <div className="bg-[#0c0c10] text-[#BBBBBB] shadow-lg shadow-[#1B5CFE] rounded-xl w-11/12 md:w-2/5 h-7/12 p-6">
            <div className="flex flex-col">
              <div className="flex flex-row justify-between items-center">
                <p className="font-semibold">Delete Vote History</p>
                <button 
                  onClick={() => {
                    setDeleteHistoryModal('scale-0')
                    setPollToDelete(null)
                  }} 
                  className="border-0 bg-transparent focus:outline-none"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="flex flex-col justify-center items-center rounded-xl mt-5 mb-5">
                <div className="flex flex-col justify-center items-center rounded-xl my-5 space-y-2">
                  <BsTrash3Fill className="text-red-600" size={50} />
                  <h4 className="text-[22.65px]">Delete Vote History</h4>
                  <p className="text-[14px]">Are you sure you want to delete this vote history entry?</p>
                  <small className="text-xs italic">{pollToDelete?.title}</small>
                </div>

                <button
                  className="h-[48px] w-full block mt-2 px-3 rounded-full text-sm font-bold
                  transition-all duration-300 bg-red-600 hover:bg-red-500"
                  onClick={() => {
                    if (!pollToDelete || !wallet) return
                    
                    // Remove vote entry from localStorage (doesn't affect the actual poll)
                    // Use wallet-specific storage so admin deletions don't affect user accounts
                    if (typeof window !== 'undefined') {
                      try {
                        const address = wallet.toLowerCase()
                        const deletedKey = `deletedVoteHistoryIds_${address}`
                        const voteRecordsKey = `userVoteRecords_${address}`
                        
                        // Get list of deleted poll IDs to track what THIS WALLET has deleted
                        const deletedPollIds = JSON.parse(localStorage.getItem(deletedKey) || '[]')
                        if (!deletedPollIds.includes(pollToDelete.id)) {
                          deletedPollIds.push(pollToDelete.id)
                          localStorage.setItem(deletedKey, JSON.stringify(deletedPollIds))
                        }
                        
                        // Remove from THIS WALLET's userVoteRecords
                        const existingVotes = JSON.parse(localStorage.getItem(voteRecordsKey) || '[]')
                        const updatedVotes = existingVotes.filter((v: UserVote) => v.poll.id !== pollToDelete.id)
                        localStorage.setItem(voteRecordsKey, JSON.stringify(updatedVotes))
                        
                        // Update state to remove from display
                        setAllUserVotes(prev => prev.filter(v => v.poll.id !== pollToDelete.id))
                        
                        // Close modal and clear poll
                        setDeleteHistoryModal('scale-0')
                        setPollToDelete(null)
                        
                        toast.success('Vote history entry deleted successfully')
                      } catch (error) {
                        console.error('Error deleting vote history:', error)
                        toast.error('Failed to delete vote history entry')
                      }
                    }
                  }}
                >
                  Delete Vote History
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

export default UserDashboard


