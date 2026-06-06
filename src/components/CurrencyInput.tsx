'use client'

import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  autoFocus?: boolean
}

export default function CurrencyInput({ value, onChange, placeholder = 'R$ 0,00', required, className, autoFocus }: Props) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    setDisplay(value)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Allow digits, comma and period only
    const cleaned = raw.replace(/[^\d,\.]/g, '')
    // Prevent multiple decimal separators
    const parts = cleaned.split(/[,\.]/)
    const normalized = parts.length > 2
      ? parts[0] + ',' + parts.slice(1).join('')
      : cleaned
    setDisplay(normalized)
    onChange(normalized)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      autoFocus={autoFocus}
      className={className}
    />
  )
}

export function parseCurrency(value: string): number {
  if (!value) return 0
  // Replace comma with period for parsing
  const normalized = value.replace(',', '.')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}
