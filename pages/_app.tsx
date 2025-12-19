import { AppProps } from 'next/app'
import '@/styles/global.css'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Provider } from 'react-redux'
import { store } from '@/store'
import { useEffect } from 'react'
import { checkWallet } from '@/services/blockchain'

//When the app loads, check if the user has a connected wallet (MetaMask) and set it in the state if it exists.”
export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    checkWallet()
  }, [])

  return (
    <Provider store={store}>
      <Component {...pageProps} />

      <ToastContainer
        position="bottom-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </Provider>
  )
}
