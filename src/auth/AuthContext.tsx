import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser } from '../types/auth'
import { clearGuest, getGuestId, getGuestName, setGuestName } from './guestStore'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  setName: (name: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    const name = getGuestName()
    if (name) {
      const id = getGuestId()
      setUser({ id, name, email: `guest-${id}@guest.local` })
      setStatus('authenticated')
    } else {
      setStatus('unauthenticated')
    }
  }, [])

  const setName = useCallback((name: string) => {
    setGuestName(name)
    const id = getGuestId()
    setUser({ id, name, email: `guest-${id}@guest.local` })
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    clearGuest()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  return (
    <AuthContext.Provider value={{ user, status, setName, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
