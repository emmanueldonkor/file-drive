'use client'

import { useEffect, useState } from 'react'
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import {
  deleteObject,
  getStorage,
  ref as storageRef,
  type FirebaseStorage,
} from 'firebase/storage'
import { app } from '@/firebaseConfig'
import { useUser } from '@clerk/nextjs'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { removeFileKey } from '@/lib/fileKeyStore'

type SharePermission = 'view' | 'download' | 'view_download'
type ExpiryOption = '24h' | '7d' | 'never'

interface UploadedFile {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
  storagePath?: string
  isEncrypted?: boolean
  iv?: string
  originalFileName?: string
  originalFileType?: string
  originalFileSize?: number
  shortUrl?: string
  sharePermission?: SharePermission
  expiresAt?: number | null
  isRevoked?: boolean
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS

const fileTypeMapping = (fileType: string) => {
  if (fileType.startsWith('image/')) return 'Image'
  if (fileType.startsWith('video/')) return 'Video'
  if (fileType === 'application/pdf') return 'PDF'
  if (fileType.includes('document')) return 'Doc'
  return 'Other'
}

const getFileName = (fileName: string) => {
  return fileName.split('.').slice(0, -1).join('.')
}

const getShareStatus = (file: UploadedFile) => {
  if (file.isRevoked) return 'Revoked'
  if (typeof file.expiresAt === 'number' && Date.now() > file.expiresAt) {
    return 'Expired'
  }
  return 'Active'
}

const inferExpiryOption = (
  expiresAt: number | null | undefined,
): ExpiryOption => {
  if (!expiresAt) return 'never'
  const remaining = expiresAt - Date.now()
  if (remaining <= ONE_DAY_MS) return '24h'
  return '7d'
}

const toExpiryTimestamp = (expiryOption: ExpiryOption) => {
  if (expiryOption === 'never') return null
  if (expiryOption === '24h') return Date.now() + ONE_DAY_MS
  return Date.now() + SEVEN_DAYS_MS
}

const getRuntimeOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  return envBaseUrl ? envBaseUrl.replace(/\/+$/, '') : 'http://localhost:3000'
}

const isLocalHostName = (hostname: string) => {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

const buildShareLink = (fileId: string, shortUrl?: string) => {
  const origin = getRuntimeOrigin()

  if (shortUrl?.trim()) {
    try {
      const parsedShortUrl = new URL(shortUrl, origin)
      const isSharePath = parsedShortUrl.pathname.startsWith('/share/')
      if (isSharePath) {
        if (isLocalHostName(parsedShortUrl.hostname)) {
          return `${origin}${parsedShortUrl.pathname}`
        }
        return parsedShortUrl.toString()
      }
    } catch {
      // Fallback to canonical format.
    }
  }

  return `${origin}/share/${fileId}`
}

const copyToClipboard = async (text: string) => {
  if (typeof window === 'undefined') return false

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textArea)
      return copied
    } catch {
      return false
    }
  }
}

const getDisplayFileName = (file: UploadedFile) => {
  const sourceName = file.originalFileName || file.fileName
  return getFileName(sourceName)
}

const getDisplayFileType = (file: UploadedFile) => {
  return file.originalFileType || file.fileType
}

const getDisplayFileSize = (file: UploadedFile) => {
  return file.originalFileSize ?? file.fileSize
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const resolveStorageReference = (
  storage: FirebaseStorage,
  file: Pick<UploadedFile, 'storagePath' | 'fileUrl'>,
) => {
  if (file.storagePath?.trim()) {
    return storageRef(storage, file.storagePath)
  }

  if (file.fileUrl?.trim()) {
    try {
      return storageRef(storage, file.fileUrl)
    } catch {
      return null
    }
  }

  return null
}

export default function Files() {
  const { user, isSignedIn } = useUser()
  const db = getFirestore(app)
  const storage = getStorage(app)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [permissionById, setPermissionById] = useState<
    Record<string, SharePermission>
  >({})
  const [expiryById, setExpiryById] = useState<Record<string, ExpiryOption>>({})

  const fetchFiles = async () => {
    if (!hasMore) return
    setLoading(true)
    try {
      const userEmail = user?.primaryEmailAddress?.emailAddress || ''
      if (!userEmail) {
        setError('Unable to identify user.')
        setLoading(false)
        return
      }

      let q = query(
        collection(db, 'uploadedFile'),
        where('userEmail', '==', userEmail),
        limit(10),
      )

      if (lastDoc) {
        q = query(
          collection(db, 'uploadedFile'),
          where('userEmail', '==', userEmail),
          startAfter(lastDoc),
          limit(10),
        )
      }

      const querySnapshot = await getDocs(q)
      if (querySnapshot.empty) {
        setHasMore(false)
      } else {
        const fileList: UploadedFile[] = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<UploadedFile>
          return {
            id: docSnap.id,
            fileName: data.fileName ?? 'Untitled',
            fileSize: data.fileSize ?? 0,
            fileType: data.fileType ?? 'application/octet-stream',
            fileUrl: data.fileUrl ?? '',
            storagePath: data.storagePath,
            isEncrypted: data.isEncrypted ?? false,
            iv: data.iv,
            originalFileName: data.originalFileName,
            originalFileType: data.originalFileType,
            originalFileSize: data.originalFileSize,
            shortUrl: data.shortUrl,
            sharePermission: data.sharePermission ?? 'view_download',
            expiresAt: data.expiresAt ?? null,
            isRevoked: data.isRevoked ?? false,
          }
        })

        setFiles((prevFiles) => [...prevFiles, ...fileList])
        setPermissionById((prev) => {
          const next = { ...prev }
          fileList.forEach((file) => {
            if (!next[file.id]) {
              next[file.id] = file.sharePermission ?? 'view_download'
            }
          })
          return next
        })
        setExpiryById((prev) => {
          const next = { ...prev }
          fileList.forEach((file) => {
            if (!next[file.id]) {
              next[file.id] = inferExpiryOption(file.expiresAt)
            }
          })
          return next
        })

        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1])
        if (querySnapshot.size < 10) setHasMore(false)
      }
      setLoading(false)
    } catch (err) {
      setError('Failed to fetch files')
      setLoading(false)
    }
  }

  const applyShareSettings = async (file: UploadedFile) => {
    const permission =
      permissionById[file.id] ?? file.sharePermission ?? 'view_download'
    const expiryOption =
      expiryById[file.id] ?? inferExpiryOption(file.expiresAt)
    const expiresAt = toExpiryTimestamp(expiryOption)
    const canonicalShareLink = buildShareLink(file.id, file.shortUrl)

    setActiveFileId(file.id)
    try {
      await updateDoc(doc(db, 'uploadedFile', file.id), {
        sharePermission: permission,
        expiresAt,
        isRevoked: false,
        shortUrl: canonicalShareLink,
      })

      setFiles((prev) =>
        prev.map((item) =>
          item.id === file.id
            ? {
                ...item,
                sharePermission: permission,
                expiresAt,
                isRevoked: false,
                shortUrl: canonicalShareLink,
              }
            : item,
        ),
      )
      toast.success('Share settings updated.')
    } catch (err) {
      toast.error('Failed to update share settings.')
    } finally {
      setActiveFileId(null)
    }
  }

  const toggleRevoke = async (file: UploadedFile) => {
    const nextRevokedState = !(file.isRevoked ?? false)
    setActiveFileId(file.id)
    try {
      await updateDoc(doc(db, 'uploadedFile', file.id), {
        isRevoked: nextRevokedState,
      })
      setFiles((prev) =>
        prev.map((item) =>
          item.id === file.id ? { ...item, isRevoked: nextRevokedState } : item,
        ),
      )
      toast.success(
        nextRevokedState ? 'Share link revoked.' : 'Share link restored.',
      )
    } catch (err) {
      toast.error('Failed to update revoke status.')
    } finally {
      setActiveFileId(null)
    }
  }

  const copyShareLink = async (file: UploadedFile) => {
    try {
      const status = getShareStatus(file)
      if (status !== 'Active') {
        toast.error(
          `Link is currently ${status.toLowerCase()}. Update settings first.`,
        )
        return
      }

      const shareCopyText = buildShareLink(file.id, file.shortUrl)

      const copied = await copyToClipboard(shareCopyText)
      if (copied) {
        toast.success('Share link copied.')
      } else if (typeof window !== 'undefined') {
        window.prompt('Copy this link:', shareCopyText)
        toast.info(
          'Clipboard permission blocked. Manual copy window is now open.',
        )
      }
    } catch (err) {
      toast.error('Failed to copy share link.')
    }
  }

  const deleteFile = async (file: UploadedFile) => {
    if (typeof window === 'undefined') return

    const confirmed = window.confirm(
      `Delete "${getDisplayFileName(file)}"? This action cannot be undone.`,
    )
    if (!confirmed) return

    setActiveFileId(file.id)
    try {
      const targetRef = resolveStorageReference(storage, file)
      if (targetRef) {
        try {
          await deleteObject(targetRef)
        } catch (storageError) {
          const errorCode = (storageError as { code?: string }).code
          if (errorCode !== 'storage/object-not-found') {
            throw storageError
          }
        }
      }

      await deleteDoc(doc(db, 'uploadedFile', file.id))
      setFiles((prev) => prev.filter((item) => item.id !== file.id))
      setPermissionById((prev) => {
        const next = { ...prev }
        delete next[file.id]
        return next
      })
      setExpiryById((prev) => {
        const next = { ...prev }
        delete next[file.id]
        return next
      })
      removeFileKey(file.id)
      toast.success('File deleted successfully.')
    } catch (err) {
      toast.error('Failed to delete file. Please try again.')
    } finally {
      setActiveFileId(null)
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      fetchFiles()
    }
    // Initial fetch is intentionally tied to sign-in/user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user])

  if (loading && files.length === 0) {
    return <p>Loading files...</p>
  }

  if (error) {
    return <p className="text-red-500">{error}</p>
  }

  return (
    <div className="p-6">
      <h3 className="mb-6 text-center text-3xl font-bold text-black-800">
        Your Uploaded Files
      </h3>
      {files.length > 0 ? (
        <>
          <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 shadow">
            <table className="min-w-full border-collapse bg-white">
              <thead className="bg-orange-400 text-white">
                <tr>
                  <th className="px-6 py-3 text-left">File Name</th>
                  <th className="px-6 py-3 text-left">File Size</th>
                  <th className="px-6 py-3 text-left">File Type</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {files.map((file) => (
                  <tr key={file.id} className="border-t hover:bg-gray-100">
                    <td className="px-6 py-3">{getDisplayFileName(file)}</td>
                    <td className="px-6 py-3">
                      {formatFileSize(getDisplayFileSize(file))}
                    </td>
                    <td className="px-6 py-3">
                      {fileTypeMapping(getDisplayFileType(file))}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 transition-colors duration-300 hover:text-blue-800"
                        >
                          Preview
                        </a>
                        <a
                          href={file.fileUrl}
                          download={file.fileName}
                          className="text-green-600 transition-colors duration-300 hover:text-green-800"
                        >
                          Download
                        </a>
                        <button
                          className="text-yellow-600 transition-colors duration-300 hover:text-yellow-800"
                          onClick={() => copyShareLink(file)}
                        >
                          Share
                        </button>
                        <button
                          className="text-red-600 transition-colors duration-300 hover:text-red-800 disabled:cursor-not-allowed disabled:text-red-300"
                          onClick={() => deleteFile(file)}
                          disabled={activeFileId === file.id}
                        >
                          {activeFileId === file.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={permissionById[file.id] ?? 'view_download'}
                          onChange={(event) => {
                            const nextPermission = event.target
                              .value as SharePermission
                            setPermissionById((prev) => ({
                              ...prev,
                              [file.id]: nextPermission,
                            }))
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="view_download">View + Download</option>
                          <option value="view">View only</option>
                          <option value="download">Download only</option>
                        </select>

                        <select
                          value={expiryById[file.id] ?? 'never'}
                          onChange={(event) => {
                            const nextExpiry = event.target
                              .value as ExpiryOption
                            setExpiryById((prev) => ({
                              ...prev,
                              [file.id]: nextExpiry,
                            }))
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="24h">Expire in 24h</option>
                          <option value="7d">Expire in 7 days</option>
                          <option value="never">Never expire</option>
                        </select>

                        <button
                          className="rounded bg-orange-500 px-2 py-1 text-xs text-white disabled:bg-gray-400"
                          disabled={activeFileId === file.id}
                          onClick={() => applyShareSettings(file)}
                        >
                          Apply
                        </button>

                        <button
                          className="rounded bg-gray-700 px-2 py-1 text-xs text-white disabled:bg-gray-400"
                          disabled={activeFileId === file.id}
                          onClick={() => toggleRevoke(file)}
                        >
                          {file.isRevoked ? 'Restore Link' : 'Revoke Link'}
                        </button>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        Status: {getShareStatus(file)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={fetchFiles}
                className="rounded-md bg-orange-500 p-3 text-white transition-colors duration-300 hover:bg-orange-600"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Files'}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-gray-700">No files uploaded yet.</p>
      )}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
      />
    </div>
  )
}
