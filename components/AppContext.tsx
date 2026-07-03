'use client'

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'

interface AppState {
  testingMode: boolean
  setTestingMode: (v: boolean) => void
  superAdmin: boolean
  setSuperAdmin: (v: boolean) => void
  /** TIME SET: milliseconds added to the real clock for all logged times (0 = off) */
  timeOffsetMs: number
  setTimeOffsetMs: (v: number) => void
  /** Current time with the TIME SET offset applied */
  appNow: () => Date
}

const AppContext = createContext<AppState>({
  testingMode: false,
  setTestingMode: () => {},
  superAdmin: false,
  setSuperAdmin: () => {},
  timeOffsetMs: 0,
  setTimeOffsetMs: () => {},
  appNow: () => new Date(),
})

export function useAppState() {
  return useContext(AppContext)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [testingMode, setTestingModeRaw] = useState(false)
  const [superAdmin, setSuperAdminRaw] = useState(false)
  const [timeOffsetMs, setTimeOffsetMsRaw] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const offsetRef = useRef(0)

  useEffect(() => {
    setTestingModeRaw(localStorage.getItem('testingMode') === 'true')
    setSuperAdminRaw(localStorage.getItem('superAdmin') === 'true')
    const off = parseInt(localStorage.getItem('timeOffsetMs') || '0', 10)
    const offset = Number.isFinite(off) ? off : 0
    setTimeOffsetMsRaw(offset)
    offsetRef.current = offset
    setLoaded(true)
  }, [])

  // While TIME SET is active, every API call carries the offset so server-side
  // timestamp defaults (check-ins, log entries, siren status) use the adjusted
  // clock without touching each call site.
  useEffect(() => {
    const orig = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
      if (offsetRef.current !== 0 && url.startsWith('/api')) {
        init = { ...(init || {}), headers: { ...((init || {}).headers || {}), 'x-time-offset-ms': String(offsetRef.current) } }
      }
      return orig(input, init)
    }
    return () => { window.fetch = orig }
  }, [])

  function setTestingMode(v: boolean) {
    setTestingModeRaw(v)
    localStorage.setItem('testingMode', String(v))
  }

  function setSuperAdmin(v: boolean) {
    setSuperAdminRaw(v)
    localStorage.setItem('superAdmin', String(v))
    // Dropping super admin also drops the adjusted clock.
    if (!v) setTimeOffsetMs(0)
  }

  function setTimeOffsetMs(v: number) {
    setTimeOffsetMsRaw(v)
    offsetRef.current = v
    localStorage.setItem('timeOffsetMs', String(v))
  }

  function appNow() {
    return new Date(Date.now() + offsetRef.current)
  }

  if (!loaded) return <>{children}</>

  return (
    <AppContext.Provider value={{ testingMode, setTestingMode, superAdmin, setSuperAdmin, timeOffsetMs, setTimeOffsetMs, appNow }}>
      {children}
    </AppContext.Provider>
  )
}
