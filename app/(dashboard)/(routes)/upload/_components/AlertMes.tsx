import { AlertCircle } from 'lucide-react'

interface AlertMesProps {
  message: string
}
export default function AlertMes({ message }: AlertMesProps) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
