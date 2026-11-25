import * as React from "react"
import { Loader2 } from "lucide-react"
import { Modal } from "@/src/components/ui/Modal"
import { Button } from "@/src/components/ui/Button"

/** "Are you sure?" before anything that changes a customer's account. */
export function ConfirmDialog({
  isOpen, title, children, confirmLabel, destructive = false, busy = false, onConfirm, onCancel,
}: {
  isOpen: boolean
  title: string
  children: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onCancel} title={title}>
      <div className="space-y-5">
        <div className="text-sm leading-relaxed text-slate-600">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
