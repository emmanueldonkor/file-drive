interface ProgressBarProps {
  progress: number
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className="mt-5 w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Uploading encrypted file...</span>
        <span>{`${clampedProgress.toFixed(0)}%`}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-300"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  )
}
