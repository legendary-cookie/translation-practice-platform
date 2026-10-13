export type WrittenDraftEditor = { token: string; release: () => void }
let currentToken: string | undefined

export function assertWrittenDraftEditor(token: string) {
  if (!token || token !== currentToken) throw new Error('This tab no longer owns the saved written draft. Reopen practice to recover it.')
}

/** Hold one origin-wide lock for the entire singleton-draft editing session. */
export async function acquireWrittenDraftEditor(): Promise<WrittenDraftEditor | undefined> {
  if (!navigator.locks) return undefined
  return new Promise((resolve, reject) => {
    void navigator.locks.request('lingo-written-draft-editor', { ifAvailable: true }, async (lock) => {
      if (!lock) { resolve(undefined); return }
      const token = crypto.randomUUID()
      currentToken = token
      await new Promise<void>((releaseLock) => {
        resolve({ token, release: () => { if (currentToken === token) currentToken = undefined; releaseLock() } })
      })
    }).catch(reject)
  })
}
