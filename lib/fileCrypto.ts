const ALGORITHM_NAME = 'AES-GCM'
const IV_LENGTH = 12

const assertCryptoSupport = () => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this environment.')
  }
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const base64ToUint8Array = (base64: string): Uint8Array => {
  const trimmedValue = base64.trim()
  const normalizedValue = trimmedValue
    .replace(/\s+/g, '+')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const missingPadding = normalizedValue.length % 4
  const paddedValue =
    missingPadding === 0
      ? normalizedValue
      : `${normalizedValue}${'='.repeat(4 - missingPadding)}`

  const binary = atob(paddedValue)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export interface EncryptionResult {
  encryptedBlob: Blob
  encryptionKey: string
  iv: string
  algorithm: 'AES-GCM'
}

export const encryptFile = async (file: File): Promise<EncryptionResult> => {
  assertCryptoSupport()

  const key = await window.crypto.subtle.generateKey(
    { name: ALGORITHM_NAME, length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const plainBuffer = await file.arrayBuffer()
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: ALGORITHM_NAME, iv: ivBytes },
    key,
    plainBuffer,
  )
  const rawKey = await window.crypto.subtle.exportKey('raw', key)

  return {
    encryptedBlob: new Blob([encryptedBuffer], {
      type: 'application/octet-stream',
    }),
    encryptionKey: arrayBufferToBase64(rawKey),
    iv: uint8ArrayToBase64(ivBytes),
    algorithm: 'AES-GCM',
  }
}

export const decryptBlob = async (
  encryptedBlob: Blob,
  encryptionKey: string,
  iv: string,
  mimeType = 'application/octet-stream',
): Promise<Blob> => {
  assertCryptoSupport()

  const keyBytes = base64ToUint8Array(encryptionKey)
  const ivBytes = base64ToUint8Array(iv)
  const key = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM_NAME },
    false,
    ['decrypt'],
  )
  const encryptedBuffer = await encryptedBlob.arrayBuffer()
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: ALGORITHM_NAME, iv: ivBytes },
    key,
    encryptedBuffer,
  )

  return new Blob([decryptedBuffer], { type: mimeType })
}
