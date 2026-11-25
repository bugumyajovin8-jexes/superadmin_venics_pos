import { useEffect, useState } from "react"
import { Input } from "@/src/components/ui/Input"
import { cn } from "@/src/lib/utils"
import { addMonths, monthLabel } from "@/src/lib/licences"

/**
 * Which month a payment counts as income in ("YYYY-MM").
 *   "new"  (recording money now):  This month · Nov | Next month · Dec | Other month
 *   "move" (a payment on record):  Oct | Nov (received) | Dec | Other month
 * "Other month" opens a month box, within two years of `received` (the same
 * limit as superadmin_set_income_month).
 */
export function IncomeMonthPicker({
  value, onChange, received, variant = "new",
}: {
  value: string
  onChange: (month: string) => void
  /** The month the money came in (for "new": this month). */
  received: string
  variant?: "new" | "move"
}) {
  const chips = variant === "new"
    ? [
        { key: received, label: `This month · ${monthLabel(received, "tiny")}` },
        { key: addMonths(received, 1), label: `Next month · ${monthLabel(addMonths(received, 1), "tiny")}` },
      ]
    : [-1, 0, 1].map(n => {
        const key = addMonths(received, n)
        return { key, label: n === 0 ? `${monthLabel(key, "tiny")} (received)` : monthLabel(key, "tiny") }
      })
  const onChip = chips.some(c => c.key === value)
  const [other, setOther] = useState(!onChip)
  // A value from elsewhere (a fresh form) that is one of the chips closes the month box.
  useEffect(() => { if (onChip) setOther(false) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const chipClass = (on: boolean) => cn(
    "rounded-md border px-3 py-1.5 text-sm",
    on ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 hover:bg-slate-50",
  )

  return (
    <div className="space-y-2" data-testid="income-month-picker">
      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <button
            key={c.key}
            type="button"
            aria-pressed={!other && value === c.key}
            data-testid={`income-chip-${c.key}`}
            onClick={() => { setOther(false); onChange(c.key) }}
            className={chipClass(!other && value === c.key)}
          >
            {c.label}
          </button>
        ))}
        <button type="button" aria-pressed={other} data-testid="income-chip-other" onClick={() => setOther(true)} className={chipClass(other)}>
          Other month
        </button>
      </div>
      {other && (
        <Input
          type="month"
          aria-label="Month it counts in"
          data-testid="income-month-input"
          min={addMonths(received, -24)}
          max={addMonths(received, 24)}
          value={value}
          onChange={e => { if (e.target.value) onChange(e.target.value) }}
          className="max-w-[12rem]"
        />
      )}
    </div>
  )
}
