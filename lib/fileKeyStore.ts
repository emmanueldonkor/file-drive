const KEY_STORE_STORAGE_KEY = 'file-drive-encryption-keys-v1'

type KeyStore = Record<string, string>

const canUseStorage = () => typeof window !== 'undefined'

const readStore = (): KeyStore => {
  if (!canUseStorage()) return {}

  try {
    const raw = window.localStorage.getItem(KEY_STORE_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as KeyStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeStore = (store: KeyStore) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(KEY_STORE_STORAGE_KEY, JSON.stringify(store))
}

export const saveFileKey = (fileId: string, key: string) => {
  if (!fileId || !key) return
  const store = readStore()
  store[fileId] = key
  writeStore(store)
}

export const getFileKey = (fileId: string): string | null => {
  const store = readStore()
  return store[fileId] ?? null
}
