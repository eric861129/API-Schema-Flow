/** 每筆資料的世代號在同一個交易內比較，避免其他分頁的更新遭覆寫。 */
export interface ReviewStorageRecord {
  readonly generation: number
  readonly value: unknown
}
const DATABASE = 'api-schema-flow-review'
const STORE = 'sessions'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onerror = () => reject(request.error ?? new Error('Cannot open local storage.'))
    request.onblocked = () => {
      blocked = true
      reject(new Error('Storage upgrade blocked by another tab. Close the other tab and retry.'))
    }
    request.onsuccess = () => {
      if (blocked) {
        request.result.close()
        return
      }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

export async function readStoredReview(key: string): Promise<ReviewStorageRecord | undefined> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).get(key)
    transaction.oncomplete = () => {
      database.close()
      resolve(request.result)
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('Cannot read local review data.'))
    }
  })
}

export function writeStoredReview(
  key: string,
  generation: number,
  value: unknown,
): Promise<number> {
  return replaceStoredReview(key, generation, value, false)
}

/** 使用者確認重設後，在交易內檢查已讀取的世代並重建有效世代，保留跨分頁保護。 */
export function resetStoredReview(
  key: string,
  observedGeneration: unknown,
  value: unknown,
): Promise<number> {
  return replaceStoredReview(key, observedGeneration, value, true)
}

async function replaceStoredReview(
  key: string,
  expectedGeneration: unknown,
  value: unknown,
  reset: boolean,
): Promise<number> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    let conflict = false
    let nextGeneration = 0
    const request = store.get(key)
    request.onsuccess = () => {
      const actual = request.result?.generation ?? 0
      let sameGeneration = Object.is(actual, expectedGeneration)
      if (
        !sameGeneration &&
        reset &&
        typeof actual === 'object' &&
        typeof expectedGeneration === 'object'
      ) {
        try {
          sameGeneration = JSON.stringify(actual) === JSON.stringify(expectedGeneration)
        } catch {
          sameGeneration = false
        }
      }
      if (!sameGeneration) {
        conflict = true
        transaction.abort()
        return
      }
      const valid = Number.isSafeInteger(actual) && actual >= 0 && actual < Number.MAX_SAFE_INTEGER
      if (!valid && !reset) {
        transaction.abort()
        return
      }
      nextGeneration = reset ? Math.max(Date.now(), valid ? actual + 1 : 1) : actual + 1
      try {
        store.put({ generation: nextGeneration, value }, key)
      } catch {
        transaction.abort()
      }
    }
    transaction.oncomplete = () => {
      database.close()
      resolve(nextGeneration)
    }
    transaction.onabort = () => {
      database.close()
      reject(
        new Error(
          conflict
            ? 'Another tab changed this review. Export your current decisions, then reload saved data.'
            : 'Local save failed. Export your decisions before closing this page.',
        ),
      )
    }
  })
}
