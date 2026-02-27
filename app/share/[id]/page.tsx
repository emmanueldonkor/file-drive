'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { app } from '@/firebaseConfig'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { decryptBlob } from '@/lib/fileCrypto'

type SharePermission = 'view' | 'download' | 'view_download'

interface SharedFile {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  fileUrl: string
  sharePermission?: SharePermission
  expiresAt?: number | null
  isRevoked?: boolean
  isEncrypted?: boolean
  iv?: string
  originalFileName?: string
  originalFileType?: string
  originalFileSize?: number
}

const isExpired = (expiresAt?: number | null) => {
  return typeof expiresAt === 'number' && Date.now() > expiresAt
}

const normalizeDecryptionKey = (value: string) =>
  value.trim().replace(/\s+/g, '+')

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const getKeyFromHash = () => {
  if (typeof window === 'undefined') return ''
  const hashValue = window.location.hash.replace(/^#/, '')
  if (!hashValue) return ''

  const keyPair = hashValue
    .split('&')
    .find((pair) => pair.startsWith('k=') || pair.startsWith('key='))
  if (!keyPair) return ''

  const rawKey = keyPair.includes('=')
    ? keyPair.split('=').slice(1).join('=')
    : ''
  try {
    return normalizeDecryptionKey(decodeURIComponent(rawKey))
  } catch {
    return normalizeDecryptionKey(rawKey)
  }
}

export default function SharedFilePage() {
  const params = useParams<{ id: string }>()
  const db = getFirestore(app)
  const fileId = Array.isArray(params.id) ? params.id[0] : params.id

  const [file, setFile] = useState<SharedFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [decryptionKey, setDecryptionKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [decrypting, setDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState('')
  const [decryptedUrl, setDecryptedUrl] = useState('')

  useEffect(() => {
    const keyInHash = getKeyFromHash()
    if (keyInHash) {
      setDecryptionKey(keyInHash)
      setKeyInput(keyInHash)
    }
  }, [])

  useEffect(() => {
    const loadSharedFile = async () => {
      if (!fileId) {
        setError('Invalid share link.')
        setLoading(false)
        return
      }

      try {
        const docSnap = await getDoc(doc(db, 'uploadedFile', fileId))
        if (!docSnap.exists()) {
          setError('This shared file does not exist.')
          setLoading(false)
          return
        }

        const data = docSnap.data() as Partial<SharedFile>
        setFile({
          id: docSnap.id,
          fileName: data.fileName ?? 'Untitled',
          fileType: data.fileType ?? 'application/octet-stream',
          fileSize: data.fileSize ?? 0,
          fileUrl: data.fileUrl ?? '',
          sharePermission: data.sharePermission ?? 'view_download',
          expiresAt: data.expiresAt ?? null,
          isRevoked: data.isRevoked ?? false,
          isEncrypted: data.isEncrypted ?? false,
          iv: data.iv,
          originalFileName: data.originalFileName,
          originalFileType: data.originalFileType,
          originalFileSize: data.originalFileSize,
        })
      } catch (err) {
        setError('Unable to load shared file. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadSharedFile()
  }, [db, fileId])

  useEffect(() => {
    if (!file?.isEncrypted) {
      setDecryptError('')
      setDecryptedUrl('')
      return
    }

    if (!decryptionKey) {
      setDecryptError('')
      setDecryptedUrl('')
      return
    }

    if (!file.iv) {
      setDecryptError('Missing initialization vector for this encrypted file.')
      setDecryptedUrl('')
      return
    }

    let isCancelled = false
    let objectUrlToRevoke = ''

    const decryptSharedFile = async () => {
      setDecrypting(true)
      setDecryptError('')
      try {
        const response = await fetch(file.fileUrl)
        if (!response.ok) {
          throw new Error('Failed to fetch encrypted file')
        }
        const encryptedBlob = await response.blob()
        const decryptedBlob = await decryptBlob(
          encryptedBlob,
          decryptionKey,
          file.iv || '',
          file.originalFileType || 'application/octet-stream',
        )
        objectUrlToRevoke = URL.createObjectURL(decryptedBlob)
        if (!isCancelled) {
          setDecryptedUrl(objectUrlToRevoke)
        }
      } catch (err) {
        if (!isCancelled) {
          setDecryptError('Unable to decrypt file. Please verify your key.')
          setDecryptedUrl('')
        }
      } finally {
        if (!isCancelled) {
          setDecrypting(false)
        }
      }
    }

    decryptSharedFile()

    return () => {
      isCancelled = true
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke)
      }
    }
  }, [
    decryptionKey,
    file?.fileUrl,
    file?.id,
    file?.isEncrypted,
    file?.iv,
    file?.originalFileType,
  ])

  useEffect(() => {
    return () => {
      if (decryptedUrl) {
        URL.revokeObjectURL(decryptedUrl)
      }
    }
  }, [decryptedUrl])

  const permission = file?.sharePermission ?? 'view_download'
  const canView = permission === 'view' || permission === 'view_download'
  const canDownload =
    permission === 'download' || permission === 'view_download'

  const displayName = useMemo(
    () => file?.originalFileName || file?.fileName || 'Untitled',
    [file],
  )
  const displayType = useMemo(
    () =>
      file?.originalFileType || file?.fileType || 'application/octet-stream',
    [file],
  )
  const displaySize = useMemo(
    () => file?.originalFileSize || file?.fileSize || 0,
    [file],
  )

  const onApplyKey = () => {
    const normalized = normalizeDecryptionKey(keyInput)
    if (!normalized) {
      setDecryptError('Please provide a decryption key.')
      return
    }
    setDecryptionKey(normalized)
    if (typeof window !== 'undefined') {
      window.location.hash = `k=${encodeURIComponent(normalized)}`
    }
  }

  if (loading) {
    return (
      <p className="p-8 text-center text-gray-600">Loading shared file...</p>
    )
  }

  if (error || !file) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-red-600">Link unavailable</h1>
        <p className="mt-2 text-gray-700">{error || 'Invalid shared file.'}</p>
        <Link href="/" className="mt-4 inline-block text-red-600 underline">
          Go back home
        </Link>
      </div>
    )
  }

  if (file.isRevoked) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-red-600">Link revoked</h1>
        <p className="mt-2 text-gray-700">
          The owner has revoked access to this file.
        </p>
      </div>
    )
  }

  if (isExpired(file.expiresAt)) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-amber-700">Link expired</h1>
        <p className="mt-2 text-gray-700">
          This share link has expired and is no longer available.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-16 max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-gray-900">Shared File</h1>
      <p className="mt-3 text-sm text-gray-600">
        <strong>Name:</strong> {displayName}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        <strong>Type:</strong> {displayType}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        <strong>Size:</strong> {formatFileSize(displaySize)}
      </p>
      {file.isEncrypted && (
        <p className="mt-1 text-sm text-gray-600">
          <strong>Protection:</strong> AES-GCM encrypted
        </p>
      )}

      {file.isEncrypted ? (
        <div className="mt-6">
          <label
            htmlFor="decryption-key"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Decryption Key
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="decryption-key"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="Paste decryption key"
              className="min-w-[260px] flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={onApplyKey}
              className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-black"
            >
              Unlock
            </button>
          </div>
          {decrypting && (
            <p className="mt-2 text-sm text-gray-600">Decrypting file...</p>
          )}
          {decryptError && (
            <p className="mt-2 text-sm text-red-600">{decryptError}</p>
          )}

          {decryptedUrl && (
            <div className="mt-4 flex flex-wrap gap-3">
              {canView && (
                <a
                  href={decryptedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Preview
                </a>
              )}
              {canDownload && (
                <a
                  href={decryptedUrl}
                  download={displayName}
                  className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  Download
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          {canView && (
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Preview
            </a>
          )}
          {canDownload && (
            <a
              href={file.fileUrl}
              download={displayName}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Download
            </a>
          )}
        </div>
      )}

      {!canView && !canDownload && (
        <p className="mt-4 text-red-600">
          This link currently has no access permissions enabled.
        </p>
      )}
    </div>
  )
}
