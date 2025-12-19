import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { RootState } from '@/utils/types'
import { connectWallet } from '@/services/blockchain'

const LoginPage = () => {
  const router = useRouter()
  const { isReady, query, replace } = router
  const { wallet } = useSelector((state: RootState) => state.globalStates)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [identifierError, setIdentifierError] = useState<string | null>(null)

  // IC format validation: 111111-11-1111 (6 digits, dash, 2 digits, dash, 4 digits)
  const validateICFormat = (ic: string): boolean => {
    const icRegex = /^\d{6}-\d{2}-\d{4}$/
    return icRegex.test(ic)
  }

  // Check if identifier looks like an IC number (contains dashes and numbers)
  const isICNumber = (value: string): boolean => {
    return /^\d{6}-\d{2}-\d{4}$/.test(value)
  }

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Check if input looks like an IC number (starts with digits or contains dashes)
    // If it's all digits or contains dashes, treat it as IC number and auto-format
    const looksLikeIC = /^[\d-]+$/.test(value) || (value.length > 0 && /^\d/.test(value))
    
    if (looksLikeIC) {
      // Remove all non-digit characters except dashes
      value = value.replace(/[^\d-]/g, '')
      
      // Auto-format: Add dashes at correct positions (same as register page)
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
    }
    
    setIdentifier(value)
    
    // Validate format in real-time - show error immediately if format is invalid
    // Only validate if it looks like an ID (IC number format)
    if (value && looksLikeIC) {
      // Check if format matches exactly: 111111-11-1111
      if (value.length === 14) {
        // Full length - must match exact format
        if (!validateICFormat(value)) {
          setIdentifierError('Invalid format')
        } else {
          setIdentifierError(null)
        }
      } else if (value.includes('-')) {
        // Partial input with dashes - check if format is being followed correctly
        // Pattern should be: digits (0-6), dash at 6, digits (7-8), dash at 9, digits (10-13)
        const expectedPattern = /^\d{0,6}(-\d{0,2}(-\d{0,4})?)?$/
        if (!expectedPattern.test(value)) {
          setIdentifierError('Invalid format')
        } else {
          // Check if dashes are in correct positions
          if (value.length >= 7 && value[6] !== '-') {
            setIdentifierError('Invalid format')
          } else if (value.length >= 10 && value[9] !== '-') {
            setIdentifierError('Invalid format')
          } else {
            setIdentifierError(null)
          }
        }
      } else if (/^\d+$/.test(value) && value.length > 6) {
        // Only digits, but too long without dash - will be auto-formatted, but show error if too long
        if (value.length > 12) {
          setIdentifierError('Invalid format')
        } else {
          setIdentifierError(null)
        }
      } else {
        // Still typing digits, no error yet
        setIdentifierError(null)
      }
    } else if (value && !looksLikeIC) {
      // Not in ID format - show error
      setIdentifierError('ID must be in format: 111111-11-1111')
    } else {
      // Empty - clear error
      setIdentifierError(null)
    }
  }

  useEffect(() => {
    if (!isReady) return

    if (query.registered) {
      setError(null)
      setMessage('Registration successful. You can now log in and vote.')
      replace('/login', undefined, { shallow: true })
    }
  }, [isReady, query.registered, replace])

  const handleConnectWallet = async () => {
    setError(null)
    setMessage(null)
    try {
      await connectWallet()
      setMessage('Wallet connected. You can now log in.')
    } catch (e: any) {
      setError(e?.message || 'Failed to connect wallet')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!identifier || !password) {
      setError('Please enter your ID and password.')
      return
    }
    if (!wallet) {
      setError('Please connect your MetaMask wallet before logging in.')
      return
    }

    // Validate ID format - must be in correct format (always required, no email option)
    if (!validateICFormat(identifier)) {
      setError('ID must be in format: 111111-11-1111 (e.g. 991231-10-1234)')
      setIdentifierError('ID must be in format: 111111-11-1111')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password,
          blockchainAddress: wallet,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // Store login status in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('isLoggedIn', 'true')
      }

      setMessage('Login successful. Redirecting to your dashboard...')
      setTimeout(() => {
        router.push('/user-dashboard')
      }, 800)
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Login | Secure Voting</title>
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
            <h1 className="text-2xl font-semibold">Voter Login</h1>
            <p className="text-sm text-[#B0BAC9]">
              Log in using your registered ID and password together with the same
              blockchain wallet you used during registration. This authenticates you before you can
              access voting.
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
                <label className="block text-sm mb-1">ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  className={`w-full rounded-[12px] bg-[#0E0E0E] border px-3 py-2 text-sm outline-none ${
                    identifierError ? 'border-red-500' : 'border-[#2C2C2C]'
                  }`}
                  placeholder="e.g. 991231-10-1234"
                  required
                />
                {identifierError && (
                  <p className="text-xs text-red-400 mt-1">{identifierError}</p>
                )}
                {!identifierError && identifier && identifier.includes('-') && identifier.length === 14 && (
                  <p className="text-xs text-green-400 mt-1">✓ Valid format</p>
                )}
                {!identifierError && identifier && identifier.includes('-') && identifier.length < 14 && (
                  <p className="text-xs text-[#B0BAC9] mt-1">Format: 111111-11-1111</p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[12px] bg-[#0E0E0E] border border-[#2C2C2C] px-3 py-2 text-sm outline-none"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Connected blockchain address</label>
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
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="text-center pt-4">
              <Link
                href="/register"
                className="text-sm text-[#B0BAC9] hover:text-white transition-colors"
              >
                Don't have an account? <span className="text-[#1B5CFE] hover:underline">Register</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

export default LoginPage


