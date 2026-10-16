import { t } from '../../i18n'

export const EXAM_DRAFT_DISCARD_CONFIRMATION =
  'Permanently discard this saved exam attempt and its answers? Cancel keeps the draft on this device.'

/** Ask before invoking the caller's existing fenced run-and-journal deletion. */
export async function confirmAndDiscardExamRun(
  runId: string,
  onDiscardRun: (id: string) => void | Promise<void>,
  confirmAction: (message: string) => boolean = (message) => window.confirm(t(message)),
): Promise<boolean> {
  if (!runId || !confirmAction(EXAM_DRAFT_DISCARD_CONFIRMATION)) return false
  await onDiscardRun(runId)
  return true
}
