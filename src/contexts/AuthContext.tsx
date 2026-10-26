import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Session, type User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Team } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  team: Team | null
  isHost: boolean
  loading: boolean
  signOut: () => Promise<void>
  refreshTeam: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// Put your own email here — this makes YOU the host
const HOST_EMAILS = ['bhaveshchandnani0101@gmail.com']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  const isHost = !!user && HOST_EMAILS.includes(user.email ?? '')

  async function fetchTeam(userId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && data) {
      setTeam(data as Team)
    } else {
      setTeam(null)
    }
  }

  async function refreshTeam() {
    if (user) await fetchTeam(user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setTeam(null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchTeam(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchTeam(session.user.id)
        } else {
          setTeam(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user, team, isHost, loading, signOut, refreshTeam }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}