'use client'

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'

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
  /** Callsign of whoever is operating this device (remembered per device) */
  deviceCallsign: string
  setDeviceCallsign: (v: string) => void
}

const AppContext = createContext<AppState>({
  testingMode: false,
  setTestingMode: () => {},
  superAdmin: false,
  setSuperAdmin: () => {},
  timeOffsetMs: 0,
  setTimeOffsetMs: () => {},
  appNow: () => new Date(),
  deviceCallsign: '',
  setDeviceCallsign: () => {},
})

export function useAppState() {
  return useContext(AppContext)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [testingMode, setTestingModeRaw] = useState(false)
  const [superAdmin, setSuperAdminRaw] = useState(false)
  const [timeOffsetMs, setTimeOffsetMsRaw] = useState(0)
  const [deviceCallsign, setDeviceCallsignRaw] = useState('')
  const [loaded, setLoaded] = useState(false)
  const offsetRef = useRef(0)

  useEffect(() => {
    setTestingModeRaw(localStorage.getItem('testingMode') === 'true')
    setSuperAdminRaw(localStorage.getItem('superAdmin') === 'true')
    setDeviceCallsignRaw(localStorage.getItem('deviceCallsign') || '')
    const off = parseInt(localStorage.getItem('timeOffsetMs') || '0', 10)
    const offset = Number.isFinite(off) ? off : 0
    setTimeOffsetMsRaw(offset)
    offsetRef.current = offset
    setLoaded(true)
  }, [])

  // Every API call goes through this wrapper: TIME SET offset header when
  // active, and a toast whenever a write fails (bad connection during a storm
  // must not mean silent data loss). Auth endpoints handle their own errors.
  useEffect(() => {
    const orig = window.fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
      if (offsetRef.current !== 0 && url.startsWith('/api')) {
        init = { ...(init || {}), headers: { ...((init || {}).headers || {}), 'x-time-offset-ms': String(offsetRef.current) } }
      }
      const method = (init?.method || 'GET').toUpperCase()
      const watched = url.startsWith('/api') && method !== 'GET' && !url.startsWith('/api/auth')
      try {
        const res = await orig(input, init)
        if (watched && !res.ok && res.status !== 401) {
          toast.error(`Save failed (${res.status}). Check the log before continuing.`, {
            description: `${method} ${url}`,
          })
        }
        return res
      } catch (err) {
        if (watched) {
          toast.error('Network error — that entry may not be saved.', {
            description: `${method} ${url}`,
            duration: 8000,
          })
        }
        throw err
      }
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

  function setDeviceCallsign(v: string) {
    const cs = v.toUpperCase().trim()
    setDeviceCallsignRaw(cs)
    localStorage.setItem('deviceCallsign', cs)
  }

  if (!loaded) return <>{children}</>

  return (
    <AppContext.Provider value={{ testingMode, setTestingMode, superAdmin, setSuperAdmin, timeOffsetMs, setTimeOffsetMs, appNow, deviceCallsign, setDeviceCallsign }}>
      {children}
    </AppContext.Provider>
  )
}
