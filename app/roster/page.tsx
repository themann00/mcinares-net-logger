'use client'

import { Roster } from '@/components/Roster'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'
import { useAppState } from '@/components/AppContext'
import Link from 'next/link'

export default function RosterPage() {
  const { superAdmin } = useAppState()
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-white font-semibold text-lg">Marion County ARES — Roster</h1>
        <Link href="/">
          <Button size="sm" variant="outline" className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1">
            <Home className="w-4 h-4" />
            Home
          </Button>
        </Link>
      </div>
      <div className="max-w-5xl mx-auto p-4">
        <Roster fullPage superAdmin={superAdmin} />
      </div>
    </div>
  )
}
