import { useState, useEffect, ChangeEvent, DragEvent, useRef } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { ShieldCheck, UploadCloud } from 'lucide-react'
import AlertMes from './AlertMes'
import FilePreview from './FilePreview'
import ProgressBar from './ProgressBar'

interface UploadFormProps {
  fileUploadClick: (file: File) => void
  progress: number
  fileId: string
}

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function UploadForm({
  fileUploadClick,
  progress,
  fileId,
}: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isUploadComplete, setIsUploadComplete] = useState<boolean>(false)
  const [isDragActive, setIsDragActive] = useState<boolean>(false)
  const lastSuccessFileIdRef = useRef<string>('')

  const validateAndSetFile = (selectedFile?: File) => {
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage('Maximum File Size (200MB) Exceeded!')
        setFile(null)
      } else {
        setErrorMessage(null)
        setFile(selectedFile)
      }
    }
  }

  const onFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(event.target.files?.[0])
  }

  const onDropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    validateAndSetFile(event.dataTransfer.files?.[0])
  }

  useEffect(() => {
    if (progress === 100 && fileId && lastSuccessFileIdRef.current !== fileId) {
      lastSuccessFileIdRef.current = fileId
      toast.success('File uploaded successfully!', {
        toastId: `upload-success-${fileId}`,
      })
      setIsUploadComplete(true)
      setTimeout(() => {
        setFile(null)
        setIsUploadComplete(false)
      }, 2000)
    }
  }, [progress, fileId])

  return (
    <div className="mx-auto mt-6 max-w-3xl text-center">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="mb-5 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          Client-side AES-GCM encryption enabled
        </div>
      </div>
      <div className="flex w-full items-center justify-center">
        <label
          htmlFor="dropzone-file"
          className={`relative flex h-72 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white px-6 transition-all ${
            isDragActive
              ? 'border-red-400 bg-red-50/70'
              : 'border-red-200 hover:border-red-300 hover:bg-red-50/40'
          }`}
          onDragEnter={() => setIsDragActive(true)}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={onDropFile}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-50/90 via-white to-orange-50/70" />
          <span className="sr-only">Upload file</span>
          <div className="relative z-10 flex flex-col items-center justify-center pb-6 pt-5">
            <div className="mb-4 rounded-full bg-white p-4 shadow-sm ring-1 ring-red-100">
              <UploadCloud className="h-9 w-9 text-red-500" />
            </div>
            <p className="mb-2 text-lg text-slate-600 md:text-2xl">
              <span className="font-semibold text-slate-800">
                Click to upload
              </span>{' '}
              or drag and drop
            </p>
            <p className="mb-1 text-sm text-slate-500">
              Your file will be encrypted before it is uploaded.
            </p>
            <p className="text-xs text-slate-500">
              Supported: SVG, PNG, JPG, PDF, GIF | Maximum size: 200MB
            </p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={onFileSelect}
          />
        </label>
      </div>
      {errorMessage && (
        <div className="mt-4">
          <AlertMes message={errorMessage} />
        </div>
      )}
      {file && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <FilePreview file={file} removeFile={() => setFile(null)} />
        </div>
      )}
      {progress > 0 && progress < 100 ? (
        <ProgressBar progress={progress} />
      ) : (
        <button
          disabled={!file || isUploadComplete}
          className="mt-6 w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400 md:w-auto md:min-w-[220px]"
          onClick={() => {
            if (file) {
              fileUploadClick(file)
              setIsUploadComplete(false)
            }
          }}
        >
          {file
            ? `Upload Encrypted File (${formatFileSize(file.size)})`
            : 'Upload Encrypted File'}
        </button>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Tip: keep file names clean and share decryption keys separately.
      </p>
    </div>
  )
}
