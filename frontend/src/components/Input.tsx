import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? label

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm text-content-secondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        {...rest}
        className={`bg-input-bg text-input-text placeholder:text-input-placeholder rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-interactive-primary ${className}`}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
})
