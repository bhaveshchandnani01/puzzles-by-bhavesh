
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function Input({
  label,
  hint,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <div className="w-full space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-[#e8dfcc]"
      >
        {label}
      </label>

      <input
        id={inputId}
        className={`block w-full rounded-xl border border-[#49402b] bg-[#101010] px-4 py-3 text-sm text-[#f5f0e6] placeholder:text-[#77736b] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 ${className}`}
        {...props}
      />

      {hint && (
        <p className="text-xs leading-relaxed text-[#99938a]">
          {hint}
        </p>
      )}
    </div>
  )
}
