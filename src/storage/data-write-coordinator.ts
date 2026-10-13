export const DATA_WRITE_LOCK_NAME = 'lingo-practice-local-data-v1'
export const DATA_EPOCH_STORAGE_KEY = 'lingo-practice-data-epoch-v1'
export const DATA_CLEARED_NOTICE = 'lingo-practice-data-cleared-v1'

const INITIAL_EPOCH = 'active:initial'

export class DataEpochInvalidatedError extends Error {
  constructor() {
    super('Local data was deleted or changed in another tab. Refresh this tab before saving more work.')
    this.name = 'DataEpochInvalidatedError'
  }
}

export class CrossTabClearUnavailableError extends Error {
  constructor() {
    super('Safe cross-tab deletion is unavailable in this browser. Close other Lingo Practice tabs and use a browser with Web Locks support before deleting local data.')
    this.name = 'CrossTabClearUnavailableError'
  }
}

type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: 'shared' | 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T>
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export type DataWriteCoordinator = ReturnType<typeof createDataWriteCoordinator>

export function createDataWriteCoordinator(options: {
  getLockManager?: () => LockManagerLike | undefined
  getStorage?: () => StorageLike | undefined
  createEpoch?: () => string
  onCleared?: (epoch: string) => void
} = {}) {
  const getLockManager = options.getLockManager ?? (() => {
    try {
      return globalThis.navigator?.locks as LockManagerLike | undefined
    } catch {
      return undefined
    }
  })
  const getStorage = options.getStorage ?? (() => {
    try {
      return globalThis.localStorage
    } catch {
      return undefined
    }
  })
  const createEpoch = options.createEpoch ?? (() => crypto.randomUUID())
  const readEpoch = (storage: StorageLike): string => storage.getItem(DATA_EPOCH_STORAGE_KEY) ?? INITIAL_EPOCH
  const captureEpoch = (): string | undefined => {
    try {
      const storage = getStorage()
      return storage ? readEpoch(storage) : undefined
    } catch {
      return undefined
    }
  }

  let capturedEpoch = captureEpoch()

  async function runWrite<T>(write: () => Promise<T> | T): Promise<T> {
    const requestedEpoch = capturedEpoch
    const execute = async () => {
      let storage: StorageLike | undefined
      try {
        storage = getStorage()
      } catch {
        storage = undefined
      }
      if (storage) {
        let currentEpoch: string
        try {
          currentEpoch = readEpoch(storage)
          if (storage.getItem(DATA_EPOCH_STORAGE_KEY) === null) {
            storage.setItem(DATA_EPOCH_STORAGE_KEY, INITIAL_EPOCH)
          }
        } catch {
          // Ordinary practice remains usable when storage coordination is blocked;
          // deletion fails closed and is never advertised as complete.
          return write()
        }
        if (requestedEpoch !== currentEpoch) {
          throw new DataEpochInvalidatedError()
        }
      }
      return write()
    }

    const locks = getLockManager()
    return locks
      ? locks.request(DATA_WRITE_LOCK_NAME, { mode: 'shared' }, execute)
      : execute()
  }

  async function clearData(clearOperation: () => Promise<void>): Promise<void> {
    const locks = getLockManager()
    let storage: StorageLike | undefined
    try {
      storage = getStorage()
      if (!locks || !storage) throw new CrossTabClearUnavailableError()
      // Probe access before acquiring the exclusive lock or changing the epoch.
      storage.getItem(DATA_EPOCH_STORAGE_KEY)
      storage.setItem(DATA_EPOCH_STORAGE_KEY, storage.getItem(DATA_EPOCH_STORAGE_KEY) ?? INITIAL_EPOCH)
    } catch (error) {
      if (error instanceof CrossTabClearUnavailableError) throw error
      throw new CrossTabClearUnavailableError()
    }

    await locks.request(DATA_WRITE_LOCK_NAME, { mode: 'exclusive' }, async () => {
      const previousEpoch = readEpoch(storage)
      if (capturedEpoch !== previousEpoch) throw new DataEpochInvalidatedError()

      const pendingEpoch = `pending:${createEpoch()}`
      storage.setItem(DATA_EPOCH_STORAGE_KEY, pendingEpoch)
      let clearCommitted = false
      try {
        await clearOperation()
        clearCommitted = true
        const nextEpoch = pendingEpoch.replace(/^pending:/, 'active:')
        // If this fails after the IDB transaction committed, leave the pending
        // marker in place so every old context fails closed rather than writing.
        storage.setItem(DATA_EPOCH_STORAGE_KEY, nextEpoch)
        capturedEpoch = nextEpoch
        options.onCleared?.(nextEpoch)
      } catch (error) {
        if (!clearCommitted) {
          try {
            storage.setItem(DATA_EPOCH_STORAGE_KEY, previousEpoch)
          } catch {
            // A pending marker is safer than permitting stale writers.
          }
        }
        throw error
      }
    })
  }

  async function runExclusive<T>(operation: () => Promise<T> | T): Promise<T> {
    const locks = getLockManager()
    let storage: StorageLike | undefined
    try {
      storage = getStorage()
      if (!locks || !storage) throw new CrossTabClearUnavailableError()
      storage.getItem(DATA_EPOCH_STORAGE_KEY)
      storage.setItem(DATA_EPOCH_STORAGE_KEY, storage.getItem(DATA_EPOCH_STORAGE_KEY) ?? INITIAL_EPOCH)
    } catch (error) {
      if (error instanceof CrossTabClearUnavailableError) throw error
      throw new CrossTabClearUnavailableError()
    }

    return locks.request(DATA_WRITE_LOCK_NAME, { mode: 'exclusive' }, async () => {
      if (readEpoch(storage) !== capturedEpoch) throw new DataEpochInvalidatedError()
      return operation()
    })
  }

  function assertCanClearData(): void {
    const locks = getLockManager()
    let storage: StorageLike | undefined
    try {
      storage = getStorage()
      if (!locks || !storage) throw new CrossTabClearUnavailableError()
      const currentEpoch = storage.getItem(DATA_EPOCH_STORAGE_KEY) ?? INITIAL_EPOCH
      storage.setItem(DATA_EPOCH_STORAGE_KEY, currentEpoch)
    } catch (error) {
      if (error instanceof CrossTabClearUnavailableError) throw error
      throw new CrossTabClearUnavailableError()
    }
  }

  function assertCurrentEpoch(): void {
    let storage: StorageLike | undefined
    try {
      storage = getStorage()
      if (!storage) throw new DataEpochInvalidatedError()
      const currentEpoch = readEpoch(storage)
      if (capturedEpoch !== currentEpoch) throw new DataEpochInvalidatedError()
    } catch (error) {
      if (error instanceof DataEpochInvalidatedError) throw error
      throw new DataEpochInvalidatedError()
    }
  }

  return { runWrite, runExclusive, clearData, assertCanClearData, assertCurrentEpoch }
}
