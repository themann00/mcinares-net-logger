'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Home } from 'lucide-react'
import { useAppState } from '@/components/AppContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'
import { version } from '@/package.json'

export function AppNav() {
  const { testingMode, setTestingMode, superAdmin, setSuperAdmin, timeOffsetMs, setTimeOffsetMs } = useAppState()
  const [superAdminConfirm, setSuperAdminConfirm] = useState(false)
  const [superAdminInput, setSuperAdminInput] = useState('')
  const [timeSetOpen, setTimeSetOpen] = useState(false)
  const [timeSetDate, setTimeSetDate] = useState('')
  const [timeSetTime, setTimeSetTime] = useState('')
  const [adjustedClock, setAdjustedClock] = useState('')

  const timeSetActive = timeOffsetMs !== 0

  // Live adjusted clock for the banner while TIME SET is active.
  useEffect(() => {
    if (!timeSetActive) return
    const tick = () => {
      const d = new Date(Date.now() + timeOffsetMs)
      setAdjustedClock(
        `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
      )
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [timeSetActive, timeOffsetMs])

  function openTimeSet() {
    const now = new Date()
    setTimeSetDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    setTimeSetTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    setTimeSetOpen(true)
  }

  function submitTimeSet() {
    const target = new Date(`${timeSetDate}T${timeSetTime}`)
    if (isNaN(target.getTime())) return
    setTimeOffsetMs(target.getTime() - Date.now())
    setTimeSetOpen(false)
  }

  return (
    // print:hidden — the nav and its banners never belong on a printed report
    <div className="print:hidden">
      {superAdmin && (
        <div className="bg-red-700 text-white text-center text-sm font-semibold py-1.5 px-4">
          SUPER ADMIN MODE. DELETIONS ARE PERMANENT AND CANNOT BE UNDONE.
        </div>
      )}
      {timeSetActive && (
        <div className="bg-purple-700 text-white text-center text-sm font-semibold py-1.5 px-4 font-mono">
          TIME SET ACTIVE — logging time: {adjustedClock}
        </div>
      )}
      {testingMode && (
        <div className="bg-yellow-600 text-black text-center text-sm font-semibold py-1.5 px-4">
          TESTING MODE ON. NET LOGS WILL NOT BE SAVED TO THE DATABASE AFTER CLOSING.
        </div>
      )}

      <div className="bg-surface-1/80 border-b border-surface-2 px-4 py-1.5 flex items-center gap-3">
        <Link href="/" className="text-fg-3 hover:text-fg transition-colors">
          <Home className="w-4 h-4" />
        </Link>
        <ThemeToggle />
        <span className="text-fg-4 text-xs font-mono select-none">v. {version}</span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className={`text-xs ${testingMode ? 'text-yellow-400' : 'text-fg-2'}`}>Testing</span>
          <button
            onClick={() => setTestingMode(!testingMode)}
            className={`relative w-8 h-4 rounded-full transition-colors ${testingMode ? 'bg-yellow-600' : 'bg-surface-3'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${testingMode ? 'translate-x-4' : ''}`} />
          </button>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className={`text-xs ${superAdmin ? 'text-red-400' : 'text-fg-2'}`}>Super Admin</span>
          <button
            onClick={() => {
              if (superAdmin) {
                setSuperAdmin(false)
              } else {
                setSuperAdminConfirm(true)
                setSuperAdminInput('')
              }
            }}
            className={`relative w-8 h-4 rounded-full transition-colors ${superAdmin ? 'bg-red-600' : 'bg-surface-3'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${superAdmin ? 'translate-x-4' : ''}`} />
          </button>
        </label>
        {superAdmin && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className={`text-xs ${timeSetActive ? 'text-purple-400' : 'text-fg-2'}`}>Time Set</span>
            <button
              onClick={() => {
                if (timeSetActive) setTimeOffsetMs(0)
                else openTimeSet()
              }}
              className={`relative w-8 h-4 rounded-full transition-colors ${timeSetActive ? 'bg-purple-600' : 'bg-surface-3'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${timeSetActive ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        )}
      </div>

      {timeSetOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-purple-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-fg font-semibold">Time Set</h3>
            <p className="text-fg-2 text-sm">
              Enter the &quot;current&quot; date and time. Everything logged from this moment on is
              shifted by the difference between this time and the real clock, until Time Set is
              toggled off.
            </p>
            <div className="flex gap-2">
              <div>
                <span className="text-fg-3 text-xs mb-1 block">Date</span>
                <Input
                  type="date"
                  value={timeSetDate}
                  onChange={e => setTimeSetDate(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
              <div>
                <span className="text-fg-3 text-xs mb-1 block">Time</span>
                <Input
                  type="time"
                  lang="en-GB"
                  value={timeSetTime}
                  onChange={e => setTimeSetTime(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg w-32"
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitTimeSet()
                    if (e.key === 'Escape') setTimeSetOpen(false)
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTimeSetOpen(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitTimeSet}
                disabled={!timeSetDate || !timeSetTime}
                className="bg-purple-700 hover:bg-purple-600 text-white"
              >
                Set Time
              </Button>
            </div>
          </div>
        </div>
      )}

      {superAdminConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-red-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <p className="text-red-400 font-semibold text-sm uppercase">
              Super Admins can delete previous nets with no confirmation. If you proceed, there is no way to recover lost data. Do you understand?
            </p>
            <Input
              value={superAdminInput}
              onChange={e => setSuperAdminInput(e.target.value.toUpperCase())}
              placeholder="Type YES I UNDERSTAND"
              className="bg-surface-2 border-surface-3 text-fg font-mono"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && superAdminInput === 'YES I UNDERSTAND') {
                  setSuperAdmin(true)
                  setSuperAdminConfirm(false)
                }
                if (e.key === 'Escape') setSuperAdminConfirm(false)
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSuperAdminConfirm(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (superAdminInput === 'YES I UNDERSTAND') {
                    setSuperAdmin(true)
                    setSuperAdminConfirm(false)
                  }
                }}
                disabled={superAdminInput !== 'YES I UNDERSTAND'}
                className="bg-red-700 hover:bg-red-600 text-white"
              >
                Enable
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
