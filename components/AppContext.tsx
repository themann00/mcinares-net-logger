'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AppState {
  testingMode: boolean
  setTestingMode: (v: boolean) => void
  superAdmin: boolean
  setSuperAdmin: (v: boolean) => void
}

const AppContext = createContext<AppState>({
  testingMode: false,
  setTestingMode: () => {},
  superAdmin: false,
  setSuperAdmin: () => {},
})

export function useAppState() {
  return useContext(AppContext)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [testingMode, setTestingModeRaw] = useState(false)
  const [superAdmin, setSuperAdminRaw] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setTestingModeRaw(localStorage.getItem('testingMode') === 'true')
    setSuperAdminRaw(localStorage.getItem('superAdmin') === 'true')
    setLoaded(true)
  }, [])

  function setTestingMode(v: boolean) {
    setTestingModeRaw(v)
    localStorage.setItem('testingMode', String(v))
  }

  function setSuperAdmin(v: boolean) {
    setSuperAdminRaw(v)
    localStorage.setItem('superAdmin', String(v))
  }

  if (!loaded) return <>{children}</>

  return (
    <AppContext.Provider value={{ testingMode, setTestingMode, superAdmin, setSuperAdmin }}>
      {children}
    </AppContext.Provider>
  )
}
