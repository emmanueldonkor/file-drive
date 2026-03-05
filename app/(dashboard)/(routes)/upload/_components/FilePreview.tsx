import { FileText, X } from 'lucide-react'

interface FilePreviewProps {
  file: File
  removeFile: () => void
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function FilePreview({ file, removeFile }: FilePreviewProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-white p-2 ring-1 ring-slate-200">
            <FileText className="h-5 w-5 text-red-500" />
          </div>
          <div className="min-w-0 text-left">
            <h2 className="truncate text-sm font-medium text-slate-800">
              {file.name}
            </h2>
            <h2 className="text-xs text-slate-500">
              {file.type || 'application/octet-stream'} /{' '}
              {formatFileSize(file.size)}
            </h2>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="rounded-md border border-red-100 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100"
        onClick={removeFile}
        aria-label="Remove selected file"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
