import Banner from '@/components/Banner'
import CreatePoll from '@/components/CreatePoll'
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import Polls from '@/components/Polls'
import { PollStruct, RootState } from '@/utils/types'
import Head from 'next/head'
import { useDispatch, useSelector } from 'react-redux'
import { globalActions } from '@/store/globalSlices'
import { useEffect, useState } from 'react'
import { getPolls } from '@/services/blockchain'
import { useRouter } from 'next/router'

export default function Home({ pollsData }: { pollsData: PollStruct[] }) {
  const dispatch = useDispatch()
  const { setPolls, setPoll } = globalActions
  const { polls } = useSelector((states: RootState) => states.globalStates)
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Check if user is logged in, redirect to login if not
  useEffect(() => {
    if (typeof window === 'undefined') return
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
    setIsLoggedIn(loggedIn)
    setAuthChecked(true)
    if (!loggedIn) {
      router.replace('/login')
    }
  }, [router])

  // Clear the selected poll when on home page
  useEffect(() => {
    dispatch(setPoll(null))
  }, [dispatch, setPoll])

  // Refresh polls from blockchain when page is visited, but only if polls are empty
  useEffect(() => {
    const refreshPolls = async () => {
      if (!isLoggedIn) return
      if (polls.length === 0) {
        try {
          const latestPolls = await getPolls()
          dispatch(setPolls(latestPolls))
        } catch (error) {
          console.error('Error refreshing polls:', error)
          if (pollsData.length > 0) {
            dispatch(setPolls(pollsData))
          }
        }
      }
    }
    refreshPolls()
  }, [dispatch, polls.length, pollsData, setPolls, isLoggedIn])

  // Initial load: Update Redux state with server-side props if Redux is empty
  useEffect(() => {
    if (!isLoggedIn) return
    if (polls.length === 0 && pollsData.length > 0) {
      dispatch(setPolls(pollsData))
    }
  }, [dispatch, setPolls, pollsData, polls.length, isLoggedIn])

  // Show loading while checking auth
  if (!authChecked || !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E0E] text-white">
        <p className="text-sm text-[#B0BAC9]">Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Available Polls</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen relative backdrop-blur">
        <div
          className="absolute inset-0 before:absolute before:inset-0
        before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
        before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 space-y-16 text-white sm:p-10">
          <Navbar />
          <Banner />
          <Polls polls={polls} />
          <Footer />
        </section>
        <CreatePoll />
      </div>
    </>
  )
}

export const getServerSideProps = async () => {
  try {
    const pollsData: PollStruct[] = await getPolls()
    return {
      props: {
        pollsData: JSON.parse(JSON.stringify(pollsData)),
      },
    }
  } catch (error) {
    console.error('Error fetching polls:', error)
    return {
      props: {
        pollsData: [],
      },
    }
  }
}
