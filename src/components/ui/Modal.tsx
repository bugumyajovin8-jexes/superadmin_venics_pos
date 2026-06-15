import * as React from "react"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className={`w-full rounded-xl border border-slate-200 bg-white p-6 shadow-lg flex flex-col max-h-[90vh] ${className || 'max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 transition-colors shrink-0">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}
