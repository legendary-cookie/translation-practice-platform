import type { ActiveExamRun } from '../../domain/types'

export async function getSavedExamRunAfterExit(
  savedRun: ActiveExamRun,
  readActiveRun: () => Promise<ActiveExamRun | undefined>,
): Promise<{ run: ActiveExamRun; recoveryReadFailed: boolean }> {
  try {
    return { run: (await readActiveRun()) ?? savedRun, recoveryReadFailed: false }
  } catch {
    return { run: savedRun, recoveryReadFailed: true }
  }
}
