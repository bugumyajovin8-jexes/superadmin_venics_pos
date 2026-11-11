import { useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { cn } from "@/src/lib/utils"

/**
 * Short notices in the corner: what just happened, or why it did not.
 * Errors stay longer and are announced to screen readers straight away.
 */

type Kind = "success" | "error" | "info"
interface Notice { id: number; kind: Kind; message: string }

let notices: Notice[] = []
let nextId = 1
const listeners = new Set<(n: Notice[]) => void>()
const emit = () => listeners.forEach(l => l(notices))

function dismiss(id: number) {
  notices = notices.filter(n => n.id !== id)
  emit()
}

function show(message: string, kind: Kind = "info") {
  const notice = { id: nextId++, kind, message }
  notices = [...notices, notice].slice(-5)
  emit()
  setTimeout(() => dismiss(notice.id), kind === "error" ? 10_000 : 6_000)
}

export const toast = Object.assign(show, {
  success: (message: string) => show(message, "success"),
  error: (message: string) => show(message, "error"),
})

const STYLE: Record<Kind, { box: string; icon: typeof Info }> = {
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2 },
  error: { box: "border-red-200 bg-red-50 text-red-900", icon: AlertCircle },
  info: { box: "border-slate-200 bg-white text-slate-900", icon: Info },
}

export function Toaster() {
  const [list, setList] = useState<Notice[]>(notices)
  useEffect(() => {
    listeners.add(setList)
    return () => { listeners.delete(setList) }
  }, [])
  return (
    // On a phone, above the tab bar.
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-4">
      {list.map(n => {
        const { box, icon: Icon } = STYLE[n.kind]
        return (
          <div
            key={n.id}
            role={n.kind === "error" ? "alert" : "status"}
            data-testid="toast"
            className={cn("pointer-events-auto flex items-start gap-3 rounded-lg border p-3 text-sm shadow-lg", box)}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-snug">{n.message}</p>
            <button onClick={() => dismiss(n.id)} className="rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
