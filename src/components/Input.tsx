import type { ChangeEvent } from 'react'

interface InputProps {
  label: string
  error?: string
  hint?: string
  placeholder?: string
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  type?: string
  maxLength?: number
  disabled?: boolean
  inputMode?: 'text' | 'email' | 'numeric' | 'tel' | 'url' | 'search' | 'none' | 'decimal'
  className?: string
}

export function Input({
  label,
  error,
  hint,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        {label}
      </label>
      <input
        className={`
          w-full bg-gray-800 text-white placeholder-gray-500
          border-2 rounded-xl px-4 py-3 text-lg
          focus:outline-none focus:border-yellow-400
          transition-colors duration-200
          ${error ? 'border-red-500' : 'border-gray-600'}
          ${className}
        `}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 font-medium">⚠️ {error}</p>
      )}
    </div>
  )
}