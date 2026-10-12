/**
 * Starts the microphone before source playback, but rolls transcript adoption
 * back if the source cannot begin. Recorder cleanup runs on every failure after
 * startup, so a rejected source play cannot leave an unpaired recording alive.
 */
export async function startSimultaneousTake<TSnapshot>(options: {
  startRecorder: () => Promise<unknown>
  beginTake: () => TSnapshot
  playSource: () => Promise<void>
  stopRecorder: () => Promise<unknown>
  discardTake: () => void
  rollbackTake: (snapshot: TSnapshot) => void
}): Promise<void> {
  let snapshot: TSnapshot | undefined
  let takeBegan = false
  try {
    await options.startRecorder()
    snapshot = options.beginTake()
    takeBegan = true
    await options.playSource()
  } catch (error) {
    if (takeBegan && snapshot !== undefined) {
      options.discardTake()
      options.rollbackTake(snapshot)
    }
    await options.stopRecorder().catch(() => undefined)
    throw error
  }
}
