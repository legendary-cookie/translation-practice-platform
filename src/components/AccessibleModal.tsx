import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { activateModalDialog } from './modal-dialog'
import './accessible-modal.css'

export type AccessibleModalProps = {
  open: boolean
  labelledBy: string
  describedBy?: string
  onCancel: () => void
  children: ReactNode
  className?: string
}

/** A keyboard-contained modal primitive. Hosts remain responsible for dialog content and decisions. */
export function AccessibleModal({ open, labelledBy, describedBy, onCancel, children, className }: AccessibleModalProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [activationError, setActivationError] = useState<string | undefined>()
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    const portalHost = document.createElement('div')
    portalHost.className = 'accessible-modal-host'
    document.body.append(portalHost)
    setHost(portalHost)
    return () => portalHost.remove()
  }, [])

  useLayoutEffect(() => {
    if (!open || !host) {
      setActivationError(undefined)
      return
    }
    const dialog = host.querySelector('dialog')
    if (!dialog) return
    setActivationError(undefined)
    try {
      return activateModalDialog(dialog, { onCancel: () => onCancelRef.current() })
    } catch {
      setActivationError('This browser cannot safely contain focus in this consent dialog. Cancel and continue local-only, or use a current browser.')
    }
  }, [open, host])

  if (!open || !host) return null
  if (activationError) {
    return createPortal(
      <div className="accessible-modal-failure" role="alert">
        <p>{activationError}</p>
        <button type="button" onClick={() => onCancelRef.current()}>Cancel</button>
      </div>,
      host,
    )
  }

  return createPortal(
    <dialog
      className={`accessible-modal ${className ?? ''}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
    >
      <div className="accessible-modal__panel">{children}</div>
    </dialog>,
    host,
  )
}
