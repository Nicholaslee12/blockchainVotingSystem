import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import Details from '@/components/Details'
import Contestants from '@/components/Contestants'
import Head from 'next/head'
import ContestPoll from '@/components/ContestPoll'
import { GetServerSidePropsContext } from 'next'
import { ContestantStruct, PollStruct, RootState } from '@/utils/types'
import UpdatePoll from '@/components/UpdatePoll'
import DeletePoll from '@/components/DeletePoll'
import { useDispatch, useSelector } from 'react-redux'
import { globalActions } from '@/store/globalSlices'
import { useEffect, useState } from 'react'
import { getContestants, getPoll } from '@/services/blockchain'
import ResultsModal from '@/components/ResultsModal'

export default function Polls({
  pollData,
  contestantsData,
}: {
  pollData: PollStruct
  contestantsData: ContestantStruct[]
}) {
//to update Redux state,Without dispatch, you cannot update the Redux store.
  const dispatch = useDispatch()
  const { setPoll,setContestants} = globalActions
  const { poll,contestants } = useSelector((states:RootState) => states.globalStates)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [hasDismissedResults, setHasDismissedResults] = useState(false)

  //Updating Redux state when the page loads.
  //Send pollsData into Redux store
  //It calls your reducer:state.polls = pollsData 
  //So Redux now stores the polls.
  //array: [dispatch, setPolls, pollsData] tells React when to run the effect
  //dispatch ->Only changes if Redux store changes (rare)
  //setPolls -> Only changes if actions change (rare)
  //pollsData ->Changes when server sends new data
  useEffect(()=>{
    dispatch(setPoll(pollData))
    dispatch(setContestants(contestantsData))
  },[dispatch, setPoll, pollData,setContestants,contestantsData])

  useEffect(() => {
    if (!poll) return
    if (poll.votes < 1) {
      setShowResultsModal(false)
      setHasDismissedResults(false)
      return
    }
    if (hasDismissedResults) return

    const endTime = Number(poll.endsAt)
    if (!endTime) return

    if (typeof window === 'undefined') return

    const now = Date.now()
    if (now >= endTime) {
      setShowResultsModal(true)
      return
    }

    const delay = endTime - now
    const timeoutId = window.setTimeout(() => setShowResultsModal(true), delay)
    return () => window.clearTimeout(timeoutId)
  }, [poll, hasDismissedResults])

  useEffect(() => {
    setHasDismissedResults(false)
  }, [poll?.id])

  const handleCloseResultsModal = () => {
    setShowResultsModal(false)
    setHasDismissedResults(true)
  }

  return (
    <>
      {poll && (
        <Head>
          <title>Poll | {poll.title}</title>
          <link rel="icon" href="/favicon.ico" />
        </Head>
      )}

      <div className="min-h-screen relative backdrop-blur">
        <div
          className="absolute inset-0 before:absolute before:inset-0
          before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
          before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 space-y-16 text-white sm:p-10">
          <Navbar />
          {poll && <Details poll={poll} />}
          {poll && contestants && <Contestants poll={poll} contestants={contestants} />}
          <Footer />
        </section>

        {poll && <ContestPoll poll={poll} />}
        {poll && <DeletePoll poll={poll} />}
        {poll && <UpdatePoll pollData={poll} />}
        {poll && (
          <ResultsModal
            poll={poll}
            contestants={contestants || []}
            open={showResultsModal}
            onClose={handleCloseResultsModal}
          />
        )}
      </div>
    </>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { id } = context.query
  const pollData = await getPoll(Number(id))
  const contestantData = await getContestants(Number(id))

  return {
    props: {
      pollData: JSON.parse(JSON.stringify(pollData)),
      contestantsData: JSON.parse(JSON.stringify(contestantData)),
    },
  }
}
