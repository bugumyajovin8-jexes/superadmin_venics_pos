import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/src/components/ui/Modal"
import { Button } from "@/src/components/ui/Button"
import { Input } from "@/src/components/ui/Input"
import { toast } from "@/src/components/ui/Toaster"
import { IncomeMonthPicker } from "@/src/components/IncomeMonthPicker"
import {
  SETTLE_METHODS, type LicencePayment, type PaymentMethod,
  formatDate, formatTZS, methodLabel, monthKey, monthLabel, monthsBought, setIncomeMonth, settlePayment,
} from "@/src/lib/licences"

/**
 * A renewal made before payment ("Not paid yet") is now paid: how, the
 * transaction code, and the amount if it differs from what was agreed.
 * The licence is not touched: it was extended when the renewal was made.
 */
export function SettlePaymentModal({
  payment, shopName, onClose, onDone,
}: {
  payment: LicencePayment | null
  shopName?: string
  onClose: () => void
  onDone: () => void
}) {
  const [method, setMethod] = useState<PaymentMethod>("mpesa")
  const [reference, setReference] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  // The month this money counts as income in: this month, unless it is for next month.
  const thisMonth = monthKey(new Date())
  const [incomeMonth, setIncomeMonth_] = useState(thisMonth)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!payment) return
    setMethod("mpesa"); setReference(""); setAmount(String(Number(payment.amount) || "")); setNote(""); setBusy(false); setError(null)
    setIncomeMonth_(payment.income_month ? payment.income_month.slice(0, 7) : monthKey(new Date()))
  }, [payment?.id])

  if (!payment) return null
  const agreed = Number(payment.amount) || 0
  const needsCode = SETTLE_METHODS.find(m => m.value === method)?.needsCode ?? false
  const paid = Number(amount)
  const months = monthsBought(payment)
  const countsIn = months > 1
    ? `spread over ${months} months from ${monthLabel(incomeMonth)}`
    : incomeMonth === thisMonth ? "counted in this month's income" : `counted in ${monthLabel(incomeMonth)}'s income`

  const problem = (() => {
    if (!(paid > 0)) return "Enter the amount paid."
    if (needsCode && !reference.trim()) return `Enter the ${methodLabel(method)} transaction code.`
    return null
  })()

  const submit = async () => {
    if (problem) { setError(problem); return }
    setBusy(true)
    setError(null)
    try {
      const res = await settlePayment({
        paymentId: payment.id,
        method,
        reference: needsCode || method === "bank" ? reference : undefined,
        amount: paid !== agreed ? paid : undefined,
        note,
      })
      // The month it counts in, when it is not the default (this month).
      const before = payment.income_month ? payment.income_month.slice(0, 7) : null
      const wanted = incomeMonth === thisMonth ? null : incomeMonth
      let where = incomeMonth
      if (wanted !== before) {
        try {
          await setIncomeMonth(payment.id, wanted)
        } catch (err: any) {
          where = before ?? thisMonth
          toast.error(`The payment is recorded, but it counts in ${monthLabel(where)}: ${err?.message ?? ""} Use “Move month” on it to change that.`)
        }
      }
      const resMonths = monthsBought(res)
      toast.success(`${shopName ?? "Shop"}: ${formatTZS(Number(res.amount))} received (${methodLabel(res.method)}). ${resMonths > 1
        ? `It counts as income over ${resMonths} months, from ${where === thisMonth ? "this month" : monthLabel(where)}.`
        : where === thisMonth ? "It counts in this month's income." : `It counts in ${monthLabel(where)}'s income.`}`)
      onDone()
      onClose()
    } catch (err: any) {
      setError(err?.message || "It was not recorded. Nothing was changed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={!!payment} onClose={busy ? () => {} : onClose} title={`Record payment${shopName ? `: ${shopName}` : ""}`} className="max-w-lg">
      <div className="space-y-5" data-testid="settle-modal">
        <p className="text-sm text-slate-600">
          Renewed on <strong>{formatDate(payment.created_at)}</strong> before payment: +{payment.days_added} days, to {formatDate(payment.new_expiry)}.
          Amount agreed: <strong>{formatTZS(agreed)}</strong>.
          {payment.note && <span className="italic text-slate-500"> “{payment.note}”</span>}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="settle-method">Paid by</label>
            <select
              id="settle-method"
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              {SETTLE_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="settle-amount">Amount paid (TSh)</label>
            <Input id="settle-amount" type="number" min={0} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        {paid > 0 && paid !== agreed && (
          <p className="-mt-2 text-xs text-amber-700" data-testid="settle-differs">
            Different from the {formatTZS(agreed)} agreed: {formatTZS(paid)} is what will be recorded.
          </p>
        )}

        {(needsCode || method === "bank") && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="settle-code">
              Transaction code {method === "bank" && <span className="font-normal text-slate-400">(optional)</span>}
            </label>
            <Input id="settle-code" placeholder="e.g. SK47AB9XQ" value={reference} onChange={e => setReference(e.target.value)} className="font-mono uppercase placeholder:normal-case placeholder:font-sans" />
            <p className="text-xs text-slate-500">A code can be recorded only once, so the same payment is never counted twice.</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Count as income in</label>
          <IncomeMonthPicker value={incomeMonth} onChange={setIncomeMonth_} received={thisMonth} />
          <p className="text-xs text-slate-500" data-testid="income-month-line">Received today, {countsIn}.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="settle-note">Note <span className="font-normal text-slate-400">(optional)</span></label>
          <Input id="settle-note" placeholder="e.g. paid by the owner's brother" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-white pt-3 sm:flex sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Record payment
          </Button>
        </div>
      </div>
    </Modal>
  )
}
