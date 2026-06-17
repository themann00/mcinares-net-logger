'use client'

import { Roster } from '@/components/Roster'
import { useAppState } from '@/components/AppContext'

export default function RosterPage() {
  const { superAdmin } = useAppState()
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-5xl mx-auto p-4">
        <Roster fullPage superAdmin={superAdmin} />
      </div>
    </div>
  )
}
