
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

export function Button({
  children,
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-[#e0bd50] bg-[#d4af37] px-5 py-3 text-sm font-bold text-[#15120a] transition hover:bg-[#f0d77a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717] disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? 'Please wait...' : children}
    </button>
  )
}
