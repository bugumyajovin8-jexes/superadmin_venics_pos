import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/src/components/ui/Modal"
import { Button } from "@/src/components/ui/Button"
import { toast } from "@/src/components/ui/Toaster"
import { IncomeMonthPicker } from "@/src/components/IncomeMonthPicker"
import {
  type LicencePayment,
  formatDate, formatTZS, incomeShares, incomeSpan, incomeStart, monthLabel, monthsBought, paidAt, receivedMonth, setIncomeMonth,
} from "@/src/lib/licences"

/**
 * Moving the month a payment counts as income in (2026-11-25): from this
 * month to the next, or back. The money received is not touched: only which
 * month's income it is. A payment spread over several months is spread from
 * the new month. 20261125_licence_income_month.sql records who moved it.
 */
export function MoveIncomeModal({
  payment, shopName, onClose, onDone,
}: {
  payment: LicencePayment | null
  shopName?: string
  onClose: () => void
  onDone: () => void
}) {
  const [month, setMonth] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!payment) return
    setMonth(incomeStart(payment)); setBusy(false); setError(null)
  }, [payment?.id])

  if (!payment) return null
  const received = receivedMonth(payment)
  const current = incomeStart(payment)
  const months = monthsBought(payment)
  const amount = Number(payment.amount) || 0
  const back = month === received
  const after: LicencePayment = { ...payment, income_month: back ? null : `${month}-01` }

  /** What the move does to the monthly income. */
  const effect = (() => {
    if (!month || month === current) return null
    if (months === 1) {
      return `${monthLabel(current)} income −${formatTZS(amount)} · ${monthLabel(month)} income +${formatTZS(amount)}. Received this month stays the same.`
    }
    const share = incomeShares(after)[0]?.amount ?? 0
    return `Spread ${incomeSpan(after)} (about ${formatTZS(share)} a month) instead of ${incomeSpan(payment)}. Received this month stays the same.`
  })()

  const submit = async () => {
    if (!month || month === current) { setError("Choose a different month."); return }
    setBusy(true)
    setError(null)
    try {
      await setIncomeMonth(payment.id, back ? null : month)
      toast.success(`${shopName ?? "Shop"}: ${formatTZS(amount)} now counts ${months > 1 ? `from ${monthLabel(month)}` : `in ${monthLabel(month)}`}.`)
      onDone()
      onClose()
    } catch (err: any) {
      setError(err?.message || "It was not moved. Nothing was changed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={!!payment} onClose={busy ? () => {} : onClose} title={`Move income${shopName ? `: ${shopName}` : ""}`} className="max-w-lg">
      <div className="space-y-5" data-testid="move-income-modal">
        <p className="text-sm text-slate-600">
          <strong>{formatTZS(amount)}</strong> received {formatDate(paidAt(payment))}.{" "}
          {months > 1
            ? <>Now spread over {months} months, {incomeSpan(payment)}.</>
            : <>Now counts in <strong>{monthLabel(current)}</strong>.</>}
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{months > 1 ? "Start counting it in" : "Count it in"}</label>
          <IncomeMonthPicker value={month} onChange={m => { setMonth(m); setError(null) }} received={received} variant="move" />
        </div>

        {effect && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700" data-testid="move-income-effect">{effect}</p>}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-white pt-3 sm:flex sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2" data-testid="move-income-confirm">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {month && month !== current ? `${back ? "Move back to" : "Move to"} ${monthLabel(month, "tiny")}` : "Move"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
