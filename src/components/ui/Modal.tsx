import * as React from "react"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

/**
 * A dialog: centred on a computer; on a phone, a sheet that rises from the
 * bottom, full width, where the thumb is.
 */
export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white p-5 shadow-lg sm:max-h-[90vh] sm:rounded-xl sm:p-6 ${className || 'sm:max-w-md'}`}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="shrink-0 rounded-full p-1 transition-colors hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3">
          {children}
        </div>
      </div>
    </div>
  )
}
