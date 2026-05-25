'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Radio, CloudLightning, Siren, Lock, AlertTriangle } from 'lucide-react'
import { PastNets } from '@/components/PastNets'
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
  const [allNets, setAllNets] = useState<Net[]>([])

  const fetchNets = () => {
    fetch('/api/nets')
      .then(res => {
        if (res.ok) {
          setAuthenticated(true)
          return res.json()
        }
        return []
      })
      .then((nets: Net[]) => setAllNets(nets))
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
        body: JSON.stringify({ type: selectedNet, net_controller: callsign.toUpperCase().trim() }),
      })
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
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Marion County ARES</h1>
          <p className="text-gray-400 mt-1">Net Logger</p>
        </div>

        <div className="space-y-6">
          {openNets.length > 0 && (
            <div className="space-y-3">
              {openNets.map(net => {
                const netInfo = NET_TYPES.find(n => n.type === net.type)
                return (
                  <button
                    key={net.id}
                    onClick={() => router.push(`/net/${net.id}`)}
                    className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left"
                  >
                    <div className="bg-amber-600 p-3 rounded-lg text-white flex-shrink-0">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-amber-400 font-bold text-lg">
                        RESUME: {netInfo?.label || net.type.toUpperCase()}
                      </div>
                      <div className="text-gray-400 text-sm">
                        NC: {net.net_controller} &middot; Started {new Date(net.started_at).toLocaleString()}
                      </div>
                    </div>
                  </button>
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
                <Input
                  id="callsign"
                  value={callsign}
                  onChange={e => setCallsign(e.target.value.toUpperCase())}
                  placeholder="e.g. W9ABC"
                  className="bg-gray-800 border-gray-700 text-white mt-1 uppercase"
                  autoFocus
                  required
                />
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

          <PastNets nets={allNets} onDelete={fetchNets} />
        </div>
      </div>
    </div>
  )
}
