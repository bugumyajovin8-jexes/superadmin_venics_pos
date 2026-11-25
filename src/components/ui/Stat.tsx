import * as React from "react"
import { Card, CardContent } from "@/src/components/ui/Card"

const TONES = { slate: "text-slate-400", emerald: "text-emerald-600", amber: "text-amber-600", red: "text-red-600", indigo: "text-indigo-600" }

/** One figure: what it is, the number, and a line saying what it means. */
export function Stat({ title, value, sub, icon: Icon, tone = "slate", action }: {
  title: string
  value: string
  sub?: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  tone?: keyof typeof TONES
  /** A link to where the figure can be acted on. */
  action?: { label: string; onClick: () => void }
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>
          <Icon className={`h-4 w-4 ${TONES[tone]}`} />
        </div>
        <p className="mt-1.5 text-lg font-bold leading-tight text-slate-900 sm:mt-2 sm:text-2xl" data-testid={`stat-${title}`}>{value}</p>
        {sub && <p className="mt-1 text-[11px] leading-snug text-slate-500 sm:text-xs">{sub}</p>}
        {action && (
          <button onClick={action.onClick} className="mt-2 text-xs font-medium text-indigo-600 hover:underline">
            {action.label} →
          </button>
        )}
      </CardContent>
    </Card>
  )
}
