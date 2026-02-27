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
import { encryptFile } from '@/lib/fileCrypto'
import { saveFileKey } from '@/lib/fileKeyStore'

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
    async (
      file: File,
      fileUrl: string,
      docId: string,
      storagePath: string,
      iv: string,
      algorithm: string,
    ) => {
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
          isEncrypted: true,
          encryptionAlgorithm: algorithm,
          iv,
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
      const storagePath = `file-upload/${ownerId}/${docId}-${sanitizedFileName}.enc`

      let encryptedResult: Awaited<ReturnType<typeof encryptFile>> | null = null

      try {
        encryptedResult = await encryptFile(file)
      } catch (error) {
        console.error('Encryption failed', error)
        setError('Encryption failed. Please try again.')
        return
      }

      if (!encryptedResult) return

      const encryptedFile = new File(
        [encryptedResult.encryptedBlob],
        `${sanitizedFileName}.enc`,
        {
          type: 'application/octet-stream',
        },
      )
      const metadata = {
        contentType: encryptedFile.type,
      }

      const storageRef = ref(storage, storagePath)

      const uploadTask = uploadBytesResumable(
        storageRef,
        encryptedFile,
        metadata,
      )

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
            await saveInfo(
              file,
              downloadURL,
              docId,
              storagePath,
              encryptedResult.iv,
              encryptedResult.algorithm,
            )
            saveFileKey(docId, encryptedResult.encryptionKey)
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
    <div className="p-5 px-8 md:px-28">
      <h2 className="text-[20px] text-center m-5">
        Start <strong className="text-red-300">Uploading</strong> Files and{' '}
        <strong className="text-red-300">Share</strong>
      </h2>
      {error && <p className="text-red-500 text-center">{error}</p>}
      <UploadForm
        fileUploadClick={uploadFile}
        progress={progress}
        fileId={id}
      />
    </div>
  )
}
