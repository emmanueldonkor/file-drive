import { X } from 'lucide-react'
import Image from 'next/image'

interface FilePreviewProps {
  file: File
  removeFile: () => void
}

export default function FilePreview({ file, removeFile }: FilePreviewProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center p-2 rounded-md border-red-200">
        <Image src="/file.png" width={50} height={50} alt="file" />
        <div className="text-left ml-2">
          <h2>{file.name}</h2>
          <h2 className="text-[12px] text-gray-400">
            {file.type} / {(file.size / 1024 / 1024).toFixed(2)} MB
          </h2>
        </div>
      </div>
      <X className="text-red-500 cursor-pointer" onClick={removeFile} />
    </div>
  )
}
