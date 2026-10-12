type ModalDialogElement = HTMLDialogElement & {
  inert?: boolean
  focus(): void
  querySelector(selector: string): HTMLElement | null
  querySelectorAll(selector: string): NodeListOf<HTMLElement>
}

type InertSnapshot = { element: HTMLElement; wasInert: boolean }

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(dialog: ModalDialogElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const candidate = element as HTMLElement & { disabled?: boolean; hidden?: boolean }
    return !candidate.disabled && !candidate.hidden && candidate.tabIndex >= 0
  })
}

function safeInitialFocus(dialog: ModalDialogElement): HTMLElement {
  const cancel = dialog.querySelector<HTMLElement>('[data-modal-cancel]')
    ?? dialog.querySelector<HTMLElement>('[autofocus]')
    ?? focusableElements(dialog)[0]
  if (cancel) return cancel
  if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1')
  return dialog
}

/** Activate a native modal dialog, or a fail-safe inert-background fallback. */
export function activateModalDialog(
  dialog: ModalDialogElement,
  options: { onCancel: () => void },
): () => void {
  const document = dialog.ownerDocument
  const previousFocus = document.activeElement && typeof (document.activeElement as HTMLElement).focus === 'function'
    ? document.activeElement as HTMLElement
    : undefined
  const focusTarget = safeInitialFocus(dialog)
  const inertSnapshots: InertSnapshot[] = []
  let nativeModal = false

  if (typeof dialog.showModal === 'function') {
    try {
      dialog.showModal()
      nativeModal = dialog.open
    } catch {
      // A dialog that failed to enter the browser's top layer may only use the inert fallback.
    }
  }

  if (!nativeModal) {
    const bodyChildren = Array.from(document.body.children) as HTMLElement[]
    const supportsInert = bodyChildren.every((element) => 'inert' in element)
      && 'inert' in dialog
    if (!supportsInert) {
      throw new Error('This browser cannot safely contain focus in the consent dialog.')
    }
    for (const element of bodyChildren) {
      if (element === dialog.parentElement) continue
      inertSnapshots.push({ element, wasInert: element.inert })
      element.inert = true
    }
    dialog.classList.add('accessible-modal--fallback')
    dialog.setAttribute('open', '')
  }

  const onCancelEvent = (event: Event) => {
    event.preventDefault()
    options.onCancel()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !nativeModal) {
      event.preventDefault()
      options.onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = focusableElements(dialog)
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const activeElement = document.activeElement
    if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }
  const onFocusIn = (event: FocusEvent) => {
    if (!dialog.contains(event.target as Node)) focusTarget.focus()
  }

  dialog.addEventListener('cancel', onCancelEvent)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('focusin', onFocusIn, true)
  focusTarget.focus()

  let active = true
  return () => {
    if (!active) return
    active = false
    dialog.removeEventListener('cancel', onCancelEvent)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('focusin', onFocusIn, true)
    if (nativeModal) dialog.close()
    else {
      dialog.removeAttribute('open')
      dialog.classList.remove('accessible-modal--fallback')
    }
    for (const { element, wasInert } of inertSnapshots) element.inert = wasInert
    if (previousFocus?.isConnected) previousFocus.focus()
  }
}
