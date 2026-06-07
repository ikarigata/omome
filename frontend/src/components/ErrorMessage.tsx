interface ErrorMessageProps {
  message?: string
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null
  return (
    <div className="rounded-lg bg-danger/10 border border-danger/30 p-3 text-danger text-sm">
      {message}
    </div>
  )
}
