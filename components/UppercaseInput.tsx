'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'

interface UppercaseInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value: string
  onValueChange: (value: string) => void
}

/**
 * Controlled input that uppercases on change without losing the caret.
 * A plain `onChange={e => set(e.target.value.toUpperCase())}` makes React
 * replace the DOM value (typed lowercase != stored uppercase), which throws
 * the cursor to the end on mid-string edits.
 */
export function UppercaseInput({ value, onValueChange, ...props }: UppercaseInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <Input
      {...props}
      ref={ref}
      value={value}
      onChange={e => {
        const pos = e.target.selectionStart
        onValueChange(e.target.value.toUpperCase())
        requestAnimationFrame(() => {
          if (ref.current && pos !== null) ref.current.setSelectionRange(pos, pos)
        })
      }}
    />
  )
}
