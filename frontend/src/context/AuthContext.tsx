import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getStoredToken, logout as logoutService } from '../services/authService'
import { decodeJwt } from '../utils/jwt'

interface AuthUser {
  userId: string
  email: string
  role: 'user' | 'admin' | 'nutritionist'
  subscriptionTier: 'free' | 'basic' | 'premium' | 'corporate'
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const token = await getStoredToken()
      if (!token) {
        setUser(null)
        return
      }

      const decoded = decodeJwt(token)
      if (!decoded || decoded.exp * 1000 < Date.now()) {
        setUser(null)
        return
      }

      setUser({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        subscriptionTier: decoded.subscriptionTier,
      })
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false))
  }, [refreshUser])

  const logout = useCallback(async () => {
    try {
      await logoutService()
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      setUser,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
