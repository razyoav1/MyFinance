export function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />
    </div>
  )
}
