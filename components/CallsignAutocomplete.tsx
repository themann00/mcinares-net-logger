'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'

interface Suggestion {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  source: 'station' | 'roster' | 'new'
}

interface CallsignAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: Suggestion) => void
  stations?: Suggestion[]
  roster?: Suggestion[]
  placeholder?: string
  className?: string
  autoFocus?: boolean
  onEnter?: () => void
}

export function CallsignAutocomplete({
  value,
  onChange,
  onSelect,
  stations = [],
  roster = [],
  placeholder = 'W9ABC',
  className = '',
  autoFocus = false,
  onEnter,
}: CallsignAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const query = value.toUpperCase().trim()

  function getMatches(): Suggestion[] {
    if (!query) return []

    function score(cs: string): number {
      const upper = cs.toUpperCase()
      if (upper === query) return 0
      if (upper.startsWith(query)) return 1
      if (upper.includes(query)) return 2
      return -1
    }

    const rosterMap = new Map<string, Suggestion>()
    for (const r of roster) {
      rosterMap.set(r.callsign.toUpperCase(), r)
    }

    const seen = new Set<string>()
    const results: { suggestion: Suggestion; rank: number }[] = []

    for (const s of stations) {
      const sc = score(s.callsign)
      if (sc >= 0 && !seen.has(s.callsign.toUpperCase())) {
        seen.add(s.callsign.toUpperCase())
        const rosterEntry = rosterMap.get(s.callsign.toUpperCase())
        const merged: Suggestion = {
          callsign: s.callsign,
          first_name: rosterEntry?.first_name || s.first_name,
          last_name: rosterEntry?.last_name || s.last_name,
          source: 'station',
        }
        results.push({ suggestion: merged, rank: sc })
      }
    }

    for (const r of roster) {
      const sc = score(r.callsign)
      if (sc >= 0 && !seen.has(r.callsign.toUpperCase())) {
        seen.add(r.callsign.toUpperCase())
        results.push({ suggestion: r, rank: sc + 10 })
      }
    }

    results.sort((a, b) => a.rank - b.rank)
    const top = results.slice(0, 8).map(r => r.suggestion)

    // No exact match: always offer creating the typed callsign as a new
    // station, so a partial match is never the only way out.
    const hasExact = top.some(s => s.callsign.toUpperCase() === query)
    if (!hasExact) {
      top.push({ callsign: query, source: 'new' })
    }
    return top
  }

  const matches = getMatches()

  useEffect(() => {
    setHighlightIndex(0)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectMatch(suggestion: Suggestion) {
    onChange(suggestion.callsign)
    onSelect(suggestion)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) {
      if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Tab') {
      // Select the highlighted match, then let focus advance to the next field.
      if (!e.shiftKey && matches[highlightIndex]) {
        selectMatch(matches[highlightIndex])
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[highlightIndex]) {
        selectMatch(matches[highlightIndex])
      }
      if (onEnter) {
        setTimeout(onEnter, 50)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => {
          // Restore the caret after uppercasing, otherwise mid-string edits
          // jump the cursor to the end.
          const pos = e.target.selectionStart
          onChange(e.target.value.toUpperCase())
          setOpen(true)
          requestAnimationFrame(() => {
            if (inputRef.current && pos !== null) inputRef.current.setSelectionRange(pos, pos)
          })
        }}
        onFocus={() => { if (query) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`bg-surface-2 border-surface-3 text-fg uppercase font-mono ${className}`}
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {open && matches.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-2 border border-surface-4 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {matches.map((m, i) => (
            <button
              key={`${m.callsign}-${m.source}`}
              onMouseDown={e => { e.preventDefault(); selectMatch(m) }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                i === highlightIndex ? 'bg-blue-600 text-white' : 'text-fg-1 hover:bg-surface-3'
              }`}
            >
              <span className="font-mono font-semibold">
                {m.source === 'new' ? <>New station: {m.callsign}</> : m.callsign}
              </span>
              {(m.first_name || m.last_name) && (
                <span className="text-fg-3 text-xs">
                  {[m.first_name, m.last_name].filter(Boolean).join(' ')}
                </span>
              )}
              <span className={`ml-auto text-xs ${m.source === 'station' ? 'text-green-500' : m.source === 'new' ? 'text-amber-500' : 'text-fg-5'}`}>
                {m.source === 'station' ? 'checked in' : m.source === 'new' ? 'create' : 'roster'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
