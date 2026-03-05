'use client'
import { useState, useCallback } from 'react'
import { app } from '@/firebaseConfig'
import UploadForm from './_components/UploadForm'
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage'
import { doc, getFirestore, setDoc } from 'firebase/firestore'
import { useUser } from '@clerk/nextjs'
import { generateRandomString } from '@/GenerateRandomString'
import { Lock, ShieldCheck } from 'lucide-react'

export default function Upload() {
  const { user, isSignedIn } = useUser()
  const storage = getStorage(app)
  const db = getFirestore(app)
  const [id, setId] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const getBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin
    }
    const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
    return envBaseUrl ? envBaseUrl.replace(/\/+$/, '') : 'http://localhost:3000'
  }

  const sanitizeFileName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  const saveInfo = useCallback(
    async (file: File, fileUrl: string, docId: string, storagePath: string) => {
      const userEmail = user?.primaryEmailAddress?.emailAddress || ''
      const userName = user?.fullName || ''
      const baseUrl = getBaseUrl()

      try {
        await setDoc(doc(db, 'uploadedFile', docId), {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: fileUrl,
          userEmail: userEmail,
          userName: userName,
          ownerId: user?.id || '',
          storagePath,
          password: '',
          id: docId,
          shortUrl: `${baseUrl}/share/${docId}`,
          sharePermission: 'view_download',
          expiresAt: null,
          isRevoked: false,
          createdAt: Date.now(),
          isEncrypted: false,
          encryptionAlgorithm: null,
          iv: null,
          originalFileName: file.name,
          originalFileType: file.type || 'application/octet-stream',
          originalFileSize: file.size,
        })
        setId(docId)
      } catch (error) {
        console.error('Error setting document in Firestore', error)
        setError('Error setting document in Firestore. Please try again.')
      }
    },
    [db, user],
  )

  const uploadFile = useCallback(
    async (file: File) => {
      if (!isSignedIn) {
        setError('You must be signed in to upload files.')
        return
      }

      if (!file || !file.name) {
        setError('Invalid file. Please select a file.')
        return
      }

      setError('')
      setProgress(0)

      const docId = generateRandomString(20)
      const ownerId = user?.id || 'anonymous'
      const sanitizedFileName = sanitizeFileName(file.name)
      const storagePath = `file-upload/${ownerId}/${docId}-${sanitizedFileName}`
      const metadata = {
        contentType: file.type || 'application/octet-stream',
      }

      const storageRef = ref(storage, storagePath)

      const uploadTask = uploadBytesResumable(storageRef, file, metadata)

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setProgress(progress)
        },
        (error) => {
          console.error('Upload failed', error)
          setError('Upload failed. Please try again.')
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            await saveInfo(file, downloadURL, docId, storagePath)
          } catch (error) {
            console.error('Error saving file info', error)
            setError('Error saving file info. Please try again.')
          }
        },
      )
    },
    [isSignedIn, saveInfo, storage, user?.id],
  )

  return (
    <div className="px-4 py-8 md:px-10 lg:px-24">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-sm md:p-10">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-800 md:text-3xl">
            File Upload
          </h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            Upload once and share quickly with clear access controls.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Fast direct sharing
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600">
              <Lock className="h-3.5 w-3.5" />
              Share controls: view, download, expiry, revoke
            </span>
          </div>
        </div>
        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}
        <UploadForm
          fileUploadClick={uploadFile}
          progress={progress}
          fileId={id}
        />
      </div>
    </div>
  )
}
