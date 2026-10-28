import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

type Mode = 'login' | 'register'
type LoginType = 'team' | 'host'

export function AuthPage() {
  const { refreshTeam } = useAuth()

  const [mode, setMode] = useState<Mode>('register')
  const [loginType, setLoginType] = useState<LoginType>('team')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [teamName, setTeamName] = useState('')
  const [hostEmail, setHostEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  function validateTeam() {
    if (!teamName.trim()) return 'Team name is required.'
    if (teamName.trim().length < 2 || teamName.trim().length > 30) {
      return 'Team name must be between 2 and 30 characters.'
    }
    if (mode === 'register' && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return 'Enter a valid 10-digit Indian mobile number.'
    }
    if (!password) return 'Password is required.'
    if (password.length < 6) return 'Password must be at least 6 characters.'
    return ''
  }

  function validateHost() {
    if (!hostEmail.trim()) return 'Host email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail.trim())) {
      return 'Enter a valid host email address.'
    }
    if (!password) return 'Password is required.'
    return ''
  }

  async function handleRegister() {
    setError('')
    setSuccess('')

    const validationError = validateTeam()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'puzzles-auth',
        {
          body: {
            action: 'register',
            teamName: teamName.trim(),
            phone: phone.trim(),
            password,
          },
        },
      )

      if (functionError) {
        const message = await getFunctionErrorMessage(functionError)
        throw new Error(message)
      }
      if (data?.error) throw new Error(data.error)

      if (data?.session?.access_token && data?.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (sessionError) throw sessionError
        await refreshTeam()
        setSuccess('Team registered! Welcome to COINSPIRACY.')
      } else {
        setMode('login')
        setLoginType('team')
        setSuccess('Your team was created. Log in using your team name and password.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTeamLogin() {
    setError('')
    setSuccess('')

    const validationError = validateTeam()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'puzzles-auth',
        {
          body: {
            action: 'login',
            teamName: teamName.trim(),
            password,
          },
        },
      )

      if (functionError) {
        const message = await getFunctionErrorMessage(functionError)
        throw new Error(message)
      }
      if (data?.error) throw new Error(data.error)

      if (!data?.session?.access_token || !data?.session?.refresh_token) {
        throw new Error('Login failed. Check your team name and password.')
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (sessionError) throw sessionError
      await refreshTeam()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Team login failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleHostLogin() {
    setError('')
    setSuccess('')

    const validationError = validateHost()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      // Hosts use their original Supabase email/password account.
      // No team lookup or Edge Function is involved in host sign-in.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: hostEmail.trim(),
        password,
      })

      if (signInError) {
        throw new Error('Host login failed. Check your email and password.')
      }

      await refreshTeam()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Host login failed.')
    } finally {
      setLoading(false)
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode)
    setError('')
    setSuccess('')
    if (nextMode === 'register') setLoginType('team')
  }

  function changeLoginType(nextType: LoginType) {
    setLoginType(nextType)
    setError('')
    setSuccess('')
    setPassword('')
  }

  const isTeamRegistration = mode === 'register'
  const isHostLogin = mode === 'login' && loginType === 'host'

  return (
    <main className="puzzles-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[min(700px,100vw)] -translate-x-1/2 rounded-full bg-yellow-500/10 blur-[100px]"
      />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-3xl shadow-lg shadow-yellow-900/10">
            ♛
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.4em] text-yellow-500">
            The competition begins
          </p>
          <h1 className="text-4xl font-black tracking-[0.12em] text-[#f5f0e6] sm:text-5xl">
            PUZZLES
          </h1>
          <div className="mx-auto mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-yellow-600/60" />
            <span className="text-sm font-semibold tracking-[0.35em] text-yellow-500">
              2026
            </span>
            <span className="h-px w-10 bg-yellow-600/60" />
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            {isTeamRegistration
              ? 'Assemble your team. Claim your victory.'
              : isHostLogin
                ? 'Host access to the competition control room.'
                : 'Your game. Your team. Your next move.'}
          </p>
        </header>

        <section className="rounded-3xl border border-[#39301c] bg-[#171717]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#f5f0e6]">
              {isTeamRegistration
                ? 'Enter the arena'
                : isHostLogin
                  ? 'Host sign in'
                  : 'Welcome back'}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {isTeamRegistration
                ? 'Register your team to get started.'
                : isHostLogin
                  ? 'Sign in with the email and password you originally used for your host account.'
                  : 'Log in using your team name and password.'}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 rounded-xl border border-[#393939] bg-[#101010] p-1">
            <button
              type="button"
              onClick={() => changeMode('register')}
              className={`rounded-lg px-3 py-3 text-sm font-bold transition-colors ${
                mode === 'register'
                  ? 'bg-[#d4af37] text-[#101010]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create team
            </button>
            <button
              type="button"
              onClick={() => changeMode('login')}
              className={`rounded-lg px-3 py-3 text-sm font-bold transition-colors ${
                mode === 'login'
                  ? 'bg-[#d4af37] text-[#101010]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Log in
            </button>
          </div>

          {mode === 'login' && (
            <div className="mb-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeLoginType('team')}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                  loginType === 'team'
                    ? 'border-[#a98c43] bg-[#25231d] text-[#e6cf8a]'
                    : 'border-[#393939] bg-[#111111] text-zinc-400 hover:text-white'
                }`}
              >
                Team login
              </button>
              <button
                type="button"
                onClick={() => changeLoginType('host')}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                  loginType === 'host'
                    ? 'border-[#a98c43] bg-[#25231d] text-[#e6cf8a]'
                    : 'border-[#393939] bg-[#111111] text-zinc-400 hover:text-white'
                }`}
              >
                Host login
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {isHostLogin ? (
              <Input
                label="Host email"
                placeholder="you@example.com"
                value={hostEmail}
                onChange={(e) => setHostEmail(e.target.value)}
                type="email"
                autoComplete="username"
              />
            ) : (
              <Input
                label="Team name / username"
                placeholder="e.g. The Legends"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={30}
                hint={
                  isTeamRegistration
                    ? 'Use the same team name whenever you log in.'
                    : 'Enter the team name used during registration.'
                }
              />
            )}

            {isTeamRegistration && (
              <Input
                label="Captain's mobile number"
                placeholder="9876543210"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                maxLength={10}
                hint="10-digit Indian mobile number, without +91."
                type="tel"
                inputMode="numeric"
              />
            )}

            <Input
              label="Password"
              placeholder={isTeamRegistration ? 'At least 6 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={isTeamRegistration ? 'new-password' : 'current-password'}
              hint={
                isTeamRegistration
                  ? 'Remember this password for the event.'
                  : ''
              }
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-300"
            >
              <span className="mr-2">!</span>
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-green-800 bg-green-950/50 p-3 text-sm text-green-300"
            >
              {success}
            </div>
          )}

          <div className="mt-6">
            <Button
              fullWidth
              loading={loading}
              onClick={
                isTeamRegistration
                  ? handleRegister
                  : isHostLogin
                    ? handleHostLogin
                    : handleTeamLogin
              }
            >
              {loading
                ? 'Please wait...'
                : isTeamRegistration
                  ? 'Create team account →'
                  : isHostLogin
                    ? 'Sign in as host →'
                    : 'Log in →'}
            </Button>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-zinc-500">
            {isHostLogin
              ? 'Use the existing host account. Team credentials will not work here.'
              : 'Teams use a team name and password. No email or OTP required.'}
          </p>
        </section>

        <footer className="mt-7 text-center">
          <p className="text-xs tracking-wide text-zinc-600">
            PUZZLES 2026 · THINK BIG. PLAY SMART.
          </p>
        </footer>
      </div>
    </main>
  )
}

async function getFunctionErrorMessage(error: { context?: unknown; message: string }) {
  const context = error.context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      // Keep the fallback message if the response isn't JSON.
    }
  }
  return error.message || 'The authentication request failed.'
}
