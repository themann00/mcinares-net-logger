'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Home } from 'lucide-react'
import { useAppState } from '@/components/AppContext'
import Link from 'next/link'

export function AppNav() {
  const { testingMode, setTestingMode, superAdmin, setSuperAdmin } = useAppState()
  const [superAdminConfirm, setSuperAdminConfirm] = useState(false)
  const [superAdminInput, setSuperAdminInput] = useState('')

  return (
    <>
      {superAdmin && (
        <div className="bg-red-700 text-white text-center text-sm font-semibold py-1.5 px-4">
          SUPER ADMIN MODE. DELETIONS ARE PERMANENT AND CANNOT BE UNDONE.
        </div>
      )}
      {testingMode && (
        <div className="bg-yellow-600 text-black text-center text-sm font-semibold py-1.5 px-4">
          TESTING MODE ON. NET LOGS WILL NOT BE SAVED TO THE DATABASE AFTER CLOSING.
        </div>
      )}

      <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-1.5 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors">
          <Home className="w-4 h-4" />
        </Link>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className={`text-xs ${testingMode ? 'text-yellow-400' : 'text-gray-300'}`}>Testing</span>
          <button
            onClick={() => setTestingMode(!testingMode)}
            className={`relative w-8 h-4 rounded-full transition-colors ${testingMode ? 'bg-yellow-600' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${testingMode ? 'translate-x-4' : ''}`} />
          </button>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className={`text-xs ${superAdmin ? 'text-red-400' : 'text-gray-300'}`}>Super Admin</span>
          <button
            onClick={() => {
              if (superAdmin) {
                setSuperAdmin(false)
              } else {
                setSuperAdminConfirm(true)
                setSuperAdminInput('')
              }
            }}
            className={`relative w-8 h-4 rounded-full transition-colors ${superAdmin ? 'bg-red-600' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${superAdmin ? 'translate-x-4' : ''}`} />
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
    </>
  )
}
