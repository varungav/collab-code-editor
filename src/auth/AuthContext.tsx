import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { AuthUser } from '../types/auth'
import { clearToken, getToken, setToken } from './tokenStore'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'unauthenticated'))

  useEffect(() => {
    if (!getToken()) {
      return
    }

    api
      .me()
      .then((me) => {
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        clearToken()
        setStatus('unauthenticated')
      })
  }, [])

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password)
    setToken(result.token)
    setUser(result.user)
    setStatus('authenticated')
  }

  const register = async (name: string, email: string, password: string) => {
    const result = await api.register(name, email, password)
    setToken(result.token)
    setUser(result.user)
    setStatus('authenticated')
  }

  const logout = () => {
    clearToken()
    setUser(null)
    setStatus('unauthenticated')
  }

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
