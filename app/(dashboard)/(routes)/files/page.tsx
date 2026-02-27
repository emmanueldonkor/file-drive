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
} from 'firebase/firestore'
import { app } from '@/firebaseConfig'
import { useUser } from '@clerk/nextjs'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { decryptBlob } from '@/lib/fileCrypto'
import { getFileKey, saveFileKey } from '@/lib/fileKeyStore'

type SharePermission = 'view' | 'download' | 'view_download'
type ExpiryOption = '24h' | '7d' | 'never'

interface UploadedFile {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
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

const buildShareLink = (fileId: string, shortUrl?: string) => {
  if (shortUrl?.trim()) return shortUrl
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/share/${fileId}`
  }
  return `/share/${fileId}`
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

const getShareLinkForFile = (file: UploadedFile, key?: string | null) => {
  const baseLink = buildShareLink(file.id, file.shortUrl)
  if (!file.isEncrypted || !key) return baseLink
  return `${baseLink}#k=${encodeURIComponent(key)}`
}

export default function Files() {
  const { user, isSignedIn } = useUser()
  const db = getFirestore(app)
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

    setActiveFileId(file.id)
    try {
      await updateDoc(doc(db, 'uploadedFile', file.id), {
        sharePermission: permission,
        expiresAt,
        isRevoked: false,
      })

      setFiles((prev) =>
        prev.map((item) =>
          item.id === file.id
            ? {
                ...item,
                sharePermission: permission,
                expiresAt,
                isRevoked: false,
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

      let shareLink = buildShareLink(file.id, file.shortUrl)
      if (file.isEncrypted) {
        let key = getFileKey(file.id)
        if (!key) {
          const providedKey = window.prompt(
            'This file is encrypted. Enter the decryption key to include in the share link:',
          )
          if (!providedKey?.trim()) {
            toast.error('A decryption key is required to share this file.')
            return
          }
          key = providedKey.trim()
          saveFileKey(file.id, key)
        }
        shareLink = getShareLinkForFile(file, key)
      }

      if (typeof window !== 'undefined') {
        await navigator.clipboard.writeText(shareLink)
        toast.success(`Share link for "${getDisplayFileName(file)}" copied.`)
      }
    } catch (err) {
      toast.error('Failed to copy share link.')
    }
  }

  const resolveEncryptionKey = (file: UploadedFile): string | null => {
    const storedKey = getFileKey(file.id)
    if (storedKey) return storedKey

    const userProvidedKey = window.prompt(
      'Enter the decryption key for this file:',
    )
    if (!userProvidedKey?.trim()) return null
    const normalizedKey = userProvidedKey.trim()
    saveFileKey(file.id, normalizedKey)
    return normalizedKey
  }

  const downloadDecryptedFile = async (file: UploadedFile) => {
    if (!file.isEncrypted) return
    if (!file.iv) {
      toast.error('Missing encryption metadata for this file.')
      return
    }

    const encryptionKey = resolveEncryptionKey(file)
    if (!encryptionKey) {
      toast.error('Decryption key is required.')
      return
    }

    try {
      const response = await fetch(file.fileUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch encrypted file')
      }
      const encryptedBlob = await response.blob()
      const decryptedBlob = await decryptBlob(
        encryptedBlob,
        encryptionKey,
        file.iv,
        file.originalFileType || 'application/octet-stream',
      )
      const objectUrl = URL.createObjectURL(decryptedBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = file.originalFileName || file.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
      toast.success('File decrypted and downloaded.')
    } catch (error) {
      toast.error('Unable to decrypt this file. Check your key and try again.')
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
                      {(getDisplayFileSize(file) / (1024 * 1024)).toFixed(2)} MB
                    </td>
                    <td className="px-6 py-3">
                      {fileTypeMapping(getDisplayFileType(file))}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={
                            file.isEncrypted
                              ? getShareLinkForFile(file, getFileKey(file.id))
                              : file.fileUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 transition-colors duration-300 hover:text-blue-800"
                        >
                          Preview
                        </a>
                        {file.isEncrypted ? (
                          <button
                            className="text-green-600 transition-colors duration-300 hover:text-green-800"
                            onClick={() => downloadDecryptedFile(file)}
                          >
                            Download
                          </button>
                        ) : (
                          <a
                            href={file.fileUrl}
                            download={file.fileName}
                            className="text-green-600 transition-colors duration-300 hover:text-green-800"
                          >
                            Download
                          </a>
                        )}
                        <button
                          className="text-yellow-600 transition-colors duration-300 hover:text-yellow-800"
                          onClick={() => copyShareLink(file)}
                        >
                          Share
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
