export type HistoryReadResult<T> =
  | { status: 'ready'; records: T[] }
  | { status: 'failed'; records: [] }

export async function readHistoryRecords<T>(read: () => Promise<T[]>): Promise<HistoryReadResult<T>> {
  try {
    return { status: 'ready', records: await read() }
  } catch {
    return { status: 'failed', records: [] }
  }
}
