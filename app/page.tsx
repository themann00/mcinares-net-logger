'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Radio, CloudLightning, Siren, Lock, AlertTriangle, X } from 'lucide-react'
import { PastNets } from '@/components/PastNets'
import { Roster } from '@/components/Roster'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import type { Net, NetType } from '@/types'

const NET_TYPES: {
  type: NetType
  label: string
  description: string
  icon: React.ReactNode
  color: string
}[] = [
  {
    type: 'ares',
    label: 'Weekly ARES Net',
    description: 'Every Wednesday at 7:30 PM',
    icon: <Radio className="w-6 h-6" />,
    color: 'bg-blue-600',
  },
  {
    type: 'skywarn',
    label: 'Skywarn Net',
    description: 'Severe weather activation',
    icon: <CloudLightning className="w-6 h-6" />,
    color: 'bg-orange-600',
  },
  {
    type: 'siren',
    label: 'Siren Test Net',
    description: 'First Friday of the month at 11 AM',
    icon: <Siren className="w-6 h-6" />,
    color: 'bg-red-600',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [pinError, setPinError] = useState('')
  const [selectedNet, setSelectedNet] = useState<NetType | null>(null)
  const [callsign, setCallsign] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testingMode, setTestingMode] = useState(false)
  const [superAdmin, setSuperAdmin] = useState(false)
  const [superAdminConfirm, setSuperAdminConfirm] = useState(false)
  const [superAdminInput, setSuperAdminInput] = useState('')
  const [allNets, setAllNets] = useState<Net[]>([])
  const [roster, setRoster] = useState<{ callsign: string; first_name: string | null; last_name: string | null; email: string | null }[]>([])

  const fetchNets = () => {
    fetch('/api/nets')
      .then(res => {
        if (res.ok) {
          setAuthenticated(true)
          return res.json()
        }
        return []
      })
      .then(async (nets: Net[]) => {
        const staleNets = nets.filter(n => !n.closed_at && n.type === 'ares')
        for (const sn of staleNets) {
          const logRes = await fetch(`/api/nets/${sn.id}/log`)
          if (logRes.ok) {
            const logs = await logRes.json()
            if (logs.length === 0) {
              await fetch(`/api/nets/${sn.id}`, { method: 'DELETE' })
              continue
            }
          }
        }
        const freshRes = await fetch('/api/nets')
        if (freshRes.ok) setAllNets(await freshRes.json())
        else setAllNets(nets)
        const rosterRes = await fetch('/api/roster')
        if (rosterRes.ok) setRoster(await rosterRes.json())
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchNets()
  }, [])

  useEffect(() => {
    if (!authenticated) return
    fetchNets()
  }, [authenticated])

  const openNets = allNets.filter(n => !n.closed_at)

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPinError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (res.ok) {
      setAuthenticated(true)
    } else {
      setPinError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  async function handleStartNet(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedNet || !callsign.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/nets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedNet,
          net_controller: callsign.toUpperCase().trim(),
          testing: testingMode,
          defer_start: selectedNet === 'ares',
        }),
      })
      if (res.redirected || !res.headers.get('content-type')?.includes('application/json')) {
        setAuthenticated(false)
        throw new Error('Session expired. Please re-enter PIN.')
      }
      const net = await res.json()
      if (!res.ok) throw new Error(net.error || 'Failed to create net')
      router.push(`/net/${net.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error starting net')
      setLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-gray-900 border-gray-800">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="bg-blue-600 p-3 rounded-full">
                <Lock className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-white text-xl">Marion County ARES</CardTitle>
            <p className="text-gray-400 text-sm">Net Logger</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <Label htmlFor="pin" className="text-gray-300">
                  Access PIN
                </Label>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  autoFocus
                />
                {pinError && <p className="text-red-400 text-sm mt-1">{pinError}</p>}
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Enter
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {superAdmin && (
        <div className="bg-red-700 text-white text-center text-sm font-semibold py-2 px-4">
          SUPER ADMIN MODE. DELETIONS ARE PERMANENT AND CANNOT BE UNDONE.
        </div>
      )}
      {testingMode && (
        <div className="bg-yellow-600 text-black text-center text-sm font-semibold py-2 px-4">
          TESTING MODE ON. NET LOGS WILL NOT BE SAVED TO THE DATABASE AFTER CLOSING.
        </div>
      )}
      <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Marion County ARES</h1>
          <p className="text-gray-400 mt-1">Net Logger</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className={`text-sm ${testingMode ? 'text-yellow-400' : 'text-gray-600'}`}>Testing Mode</span>
              <button
                onClick={() => setTestingMode(!testingMode)}
                className={`relative w-10 h-5 rounded-full transition-colors ${testingMode ? 'bg-yellow-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${testingMode ? 'translate-x-5' : ''}`} />
              </button>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className={`text-sm ${superAdmin ? 'text-red-400' : 'text-gray-600'}`}>Super Admin</span>
              <button
                onClick={() => {
                  if (superAdmin) {
                    setSuperAdmin(false)
                  } else {
                    setSuperAdminConfirm(true)
                    setSuperAdminInput('')
                  }
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${superAdmin ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${superAdmin ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>

          {superAdminConfirm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 border border-red-700 rounded-xl w-full max-w-md p-5 space-y-4">
                <p className="text-red-400 font-semibold text-sm uppercase">
                  Super Admins can delete previous nets with no confirmation. If you proceed, there is no way to recover lost data. Do you understand?
                </p>
                <Input
                  value={superAdminInput}
                  onChange={e => setSuperAdminInput(e.target.value.toUpperCase())}
                  placeholder="Type YES I UNDERSTAND"
                  className="bg-gray-800 border-gray-700 text-white font-mono"
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
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
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

          {openNets.length > 0 && (
            <div className="space-y-3">
              {openNets.map(net => {
                const netInfo = NET_TYPES.find(n => n.type === net.type)
                return (
                  <div
                    key={net.id}
                    className={`flex items-center gap-0 rounded-xl border-2 overflow-hidden transition-all ${
                      net.testing
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-amber-500 bg-amber-500/10'
                    }`}
                  >
                    <button
                      onClick={() => router.push(`/net/${net.id}`)}
                      className="flex-1 flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className={`${net.testing ? 'bg-yellow-600' : 'bg-amber-600'} p-3 rounded-lg text-white flex-shrink-0`}>
                        <AlertTriangle className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`${net.testing ? 'text-yellow-400' : 'text-amber-400'} font-bold text-lg`}>
                          RESUME: {net.testing ? 'TESTING - ' : ''}{netInfo?.label || net.type.toUpperCase()}
                        </div>
                        <div className="text-gray-400 text-sm">
                          NC: {net.net_controller} &middot; Started {new Date(net.started_at).toLocaleString()}
                        </div>
                      </div>
                    </button>
                    {superAdmin && (
                      <button
                        onClick={async () => {
                          const now = new Date().toISOString()
                          await fetch(`/api/nets/${net.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ closed_at: now }),
                          })
                          await fetch(`/api/nets/${net.id}/log`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              entry_type: 'net_close',
                              content: `Net closed at ${new Date(now).toLocaleTimeString()} local (admin)`,
                            }),
                          })
                          fetchNets()
                        }}
                        className="px-4 py-5 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors border-l border-amber-500/30 flex-shrink-0"
                        title="Close net without report"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <h2 className="text-gray-300 font-medium mb-3">Select Net Type</h2>
            <div className="grid gap-3">
              {NET_TYPES.map(({ type, label, description, icon, color }) => (
                <button
                  key={type}
                  onClick={() => setSelectedNet(type)}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                    selectedNet === type
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                  }`}
                >
                  <div className={`${color} p-2 rounded-lg text-white flex-shrink-0`}>{icon}</div>
                  <div>
                    <div className="text-white font-medium">{label}</div>
                    <div className="text-gray-400 text-sm">{description}</div>
                  </div>
                  {selectedNet === type && (
                    <Badge className="ml-auto bg-blue-600 text-white">Selected</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedNet && (
            <form onSubmit={handleStartNet} className="space-y-4">
              <div>
                <Label htmlFor="callsign" className="text-gray-300">
                  Net Controller Callsign
                </Label>
                <div className="mt-1">
                  <CallsignAutocomplete
                    value={callsign}
                    onChange={setCallsign}
                    onSelect={s => setCallsign(s.callsign)}
                    roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
                    placeholder="e.g. W9ABC"
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={loading || !callsign.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
              >
                {loading ? 'Starting...' : 'Open Net'}
              </Button>
            </form>
          )}

          <PastNets nets={allNets} onDelete={fetchNets} superAdmin={superAdmin} />

          <Roster superAdmin={superAdmin} />
        </div>
      </div>
      </div>
    </div>
  )
}
