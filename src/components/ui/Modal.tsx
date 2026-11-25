import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** A line under the title. */
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * A dialog: centred on a computer; on a phone, a sheet that rises from the
 * bottom, full width, where the thumb is. Drawn at the end of the page, so
 * a dialog opened from inside another one sits on top of it.
 */
export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white p-5 shadow-lg sm:max-h-[90vh] sm:rounded-xl sm:p-6 ${className || 'sm:max-w-md'}`}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-1 transition-colors hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
