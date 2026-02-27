interface ProgressBarProps {
  progress: number
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="bg-gray-400 w-full mt-3 h-4 rounded-full">
      <div
        className="p-1 bg-red-500 rounded-full h-5 text-[10px] text-white"
        style={{ width: `${progress}%` }}
      >
        {`${progress.toFixed(0)}%`}
      </div>
    </div>
  )
}
