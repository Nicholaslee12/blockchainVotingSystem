import React, { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useSelector } from 'react-redux'
import { RootState } from '@/utils/types'
import Navbar from '@/components/Navbar'
import { connectWallet } from '@/services/blockchain'

const RegisterPage = () => {
  const router = useRouter()
  const { wallet } = useSelector((state: RootState) => state.globalStates)
  const [name, setName] = useState('')
  const [icNumber, setIcNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [icError, setIcError] = useState<string | null>(null)

  // IC format validation: 111111-11-1111 (6 digits, dash, 2 digits, dash, 4 digits)
  const validateICFormat = (ic: string): boolean => {
    const icRegex = /^\d{6}-\d{2}-\d{4}$/
    return icRegex.test(ic)
  }

  const handleIcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Remove all non-digit characters except dashes
    value = value.replace(/[^\d-]/g, '')
    
    // Auto-format: Add dashes at correct positions
    if (value.length > 6 && value[6] !== '-') {
      value = value.slice(0, 6) + '-' + value.slice(6)
    }
    if (value.length > 9 && value[9] !== '-') {
      value = value.slice(0, 9) + '-' + value.slice(9)
    }
    
    // Limit to 14 characters (6-2-4 format: 6 digits + dash + 2 digits + dash + 4 digits)
    if (value.length > 14) {
      value = value.slice(0, 14)
    }
    
    setIcNumber(value)
    
    // Validate format in real-time - show error immediately if format is invalid
    if (value.length > 0) {
      // Check if format matches exactly: 111111-11-1111
      if (value.length === 14) {
        // Full length - must match exact format
        if (!validateICFormat(value)) {
          setIcError('Invalid format')
        } else {
          setIcError(null)
        }
      } else {
        // Partial input - check if format is being followed correctly
        // Pattern should be: digits (0-6), dash at 6, digits (7-8), dash at 9, digits (10-13)
        const expectedPattern = /^\d{0,6}(-\d{0,2}(-\d{0,4})?)?$/
        if (!expectedPattern.test(value)) {
          setIcError('Invalid format')
        } else {
          // Check if dashes are in correct positions
          if (value.length >= 7 && value[6] !== '-') {
            setIcError('Invalid format')
          } else if (value.length >= 10 && value[9] !== '-') {
            setIcError('Invalid format')
          } else {
            setIcError(null)
          }
        }
      }
    } else {
      // Empty field - clear error
      setIcError(null)
    }
  }

  const handleConnectWallet = async () => {
    setError(null)
    setMessage(null)
    try {
      await connectWallet()
      setMessage('Wallet connected. You can now register.')
    } catch (e: any) {
      setError(e?.message || 'Failed to connect wallet')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted')
    setError(null)
    setMessage(null)

    if (!wallet) {
      setError('Please connect your MetaMask wallet before registering.')
      console.log('No wallet connected')
      return
    }

    if (!name || !icNumber || !email || !password) {
      setError('Please fill in name, ID, email and password.')
      console.log('Missing fields:', { name, icNumber, email, password: !!password })
      return
    }

    // Validate IC format
    if (!validateICFormat(icNumber)) {
      setError('ID must be in format: 111111-11-1111 (e.g. 991231-10-1234)')
      setIcError('ID must be in format: 111111-11-1111')
      return
    }

    console.log('Starting registration...', { name, email, icNumber, wallet })
    setLoading(true)
    
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('Request timeout triggered')
        controller.abort()
      }, 30000) // 30 second timeout

      console.log('Sending request to /api/auth/register')
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: icNumber,
          name,
          email,
          password,
          blockchainAddress: wallet,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log('Response received:', res.status, res.statusText)

      // Check if response is ok before parsing JSON
      if (!res.ok) {
        let errorMessage = 'Registration failed'
        try {
          const errorData = await res.json()
          errorMessage = errorData.message || errorMessage
          console.log('Error response:', errorData)
        } catch (parseError) {
          errorMessage = `Server error: ${res.status} ${res.statusText}`
          console.log('Failed to parse error response:', parseError)
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      console.log('Registration successful:', data)
      
      // Clear form on success
      setName('')
      setIcNumber('')
      setEmail('')
      setPassword('')
      setMessage(null)
      setLoading(false) // Reset loading before navigation
      
      // Redirect to login page
      console.log('Redirecting to login page...')
      router.push({
        pathname: '/login',
        query: { registered: '1' },
      })
    } catch (e: any) {
      console.error('Registration error:', e)
      // Handle abort (timeout)
      if (e.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.')
      } else if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setError('Network error. Please check your connection and ensure the server is running.')
      } else {
        setError(e?.message || 'Registration failed. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Register | Secure Voting</title>
      </Head>
      <div className="min-h-screen relative backdrop-blur text-white">
        <div
          className="absolute inset-0 before:absolute before:inset-0
          before:w-full before:h-full before:bg-[url('/assets/images/bg.jpeg')]
          before:blur-sm before:z-[-1] before:bg-no-repeat before:bg-cover"
        />

        <section className="relative px-5 py-10 sm:p-10">
          <Navbar />

          <div className="mx-auto mt-10 max-w-xl rounded-[24px] bg-[#151515]/80 border border-[#2C2C2C] p-8 space-y-6">
            <h1 className="text-2xl font-semibold">Voter Registration</h1>
            <p className="text-sm text-[#B0BAC9]">
              Register with your name, ID, email and password. Each registered voter is
              linked to a unique blockchain wallet address and duplicate registrations are blocked.
            </p>

            <button
              type="button"
              onClick={handleConnectWallet}
              className="w-full rounded-[30.5px] bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1a4fe0] transition-colors"
            >
              {wallet ? `Wallet connected: ${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Connect MetaMask wallet'}
            </button>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-[12px] bg-[#0E0E0E] border border-[#2C2C2C] px-3 py-2 text-sm outline-none"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">ID</label>
                <input
                  type="text"
                  value={icNumber}
                  onChange={handleIcChange}
                  className={`w-full rounded-[12px] bg-[#0E0E0E] border px-3 py-2 text-sm outline-none ${
                    icError ? 'border-red-500' : 'border-[#2C2C2C]'
                  }`}
                  placeholder="e.g. 991231-10-1234"
                  pattern="\d{6}-\d{2}-\d{4}"
                  maxLength={14}
                  required
                />
                {icError && <p className="text-xs text-red-400 mt-1">{icError}</p>}
                {!icError && icNumber && icNumber.length === 14 && (
                  <p className="text-xs text-green-400 mt-1">✓ Valid format</p>
                )}
                {!icError && icNumber && icNumber.length < 14 && (
                  <p className="text-xs text-[#B0BAC9] mt-1">Format: 111111-11-1111</p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[12px] bg-[#0E0E0E] border border-[#2C2C2C] px-3 py-2 text-sm outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[12px] bg-[#0E0E0E] border border-[#2C2C2C] px-3 py-2 text-sm outline-none"
                  placeholder="Choose a strong password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Linked blockchain address</label>
                <input
                  type="text"
                  value={wallet || ''}
                  readOnly
                  className="w-full rounded-[12px] bg-[#0E0E0E] border border-dashed border-[#2C2C2C] px-3 py-2 text-sm outline-none text-[#B0BAC9]"
                  placeholder="Connect your wallet to populate this field"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {message && !error && <p className="text-sm text-green-400">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[30.5px] bg-[#1B5CFE] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1a4fe0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            <div className="text-center pt-4">
              <Link
                href="/login"
                className="text-sm text-[#B0BAC9] hover:text-white transition-colors"
              >
                Already have an account? <span className="text-[#1B5CFE] hover:underline">Log in</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

export default RegisterPage


