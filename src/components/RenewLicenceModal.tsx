import { useEffect, useMemo, useState } from "react"
import { Loader2, MessageSquare, AlertCircle, Clock } from "lucide-react"
import { Modal } from "@/src/components/ui/Modal"
import { IncomeMonthPicker } from "@/src/components/IncomeMonthPicker"
import { Button } from "@/src/components/ui/Button"
import { Input } from "@/src/components/ui/Input"
import { toast } from "@/src/components/ui/Toaster"
import { useRenewalSms } from "@/src/lib/settings"
import { cn, formatTzPhone } from "@/src/lib/utils"
import {
  PAYMENT_METHODS, type PaymentMethod, type Owner, type LicencePayment,
  contactFor, daysFromNow, describeDays, expiryAfter, formatDate, formatTZS, methodLabel,
  monthKey, monthLabel, monthsBought, renewLicence, renewalSmsText, sendRenewalSms, setIncomeMonth,
} from "@/src/lib/licences"

/** What the form needs to know about the shop being renewed. */
export interface RenewTarget {
  id: string
  name: string
  created_by: string | null
  owners: Owner[]
  /** Current licence expiry, or null when the shop has no licence yet. */
  expiry: string | null
  licenceStatus?: string | null
  /** Shown as a hint for the amount. */
  lastPayment?: LicencePayment | null
  /** Renewals already made before payment and still not paid. */
  owed?: { amount: number; count: number; since: string } | null
}

const PERIODS = [30, 90, 180, 365]

/**
 * Renewing a licence: how long, how much, how it was paid, and the owner's
 * SMS. Nothing happens until "Confirm renewal": opening this IS the
 * confirmation step that the old one-click "+30d" lacked.
 */
export function RenewLicenceModal({
  target, initialDays = 30, initialMode = "days", onClose, onDone,
}: {
  target: RenewTarget | null
  initialDays?: number
  initialMode?: "days" | "date"
  onClose: () => void
  onDone: () => void
}) {
  const [mode, setMode] = useState<"days" | "date">(initialMode)
  const [days, setDays] = useState(initialDays)
  const [date, setDate] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("mpesa")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [sendSms, setSendSms] = useState(true)
  // The month this money counts as income in: this month, unless paid for next month.
  const thisMonth = monthKey(new Date())
  const [incomeMonth, setIncomeMonth_] = useState(thisMonth)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Settings → "Owner SMS on renewal". Off (or still being read): no SMS at all.
  const smsOn = useRenewalSms() === true

  // A fresh form for every shop.
  useEffect(() => {
    if (!target) return
    setMode(initialMode); setDays(initialDays); setDate(""); setAmount(""); setMethod("mpesa")
    setReference(""); setNote(""); setSendSms(true); setIncomeMonth_(monthKey(new Date())); setBusy(false); setError(null)
  }, [target?.id, initialMode, initialDays])

  const contact = target ? contactFor({ created_by: target.created_by, owners: target.owners }) : null
  const free = method === "free"
  // "Not paid yet": the licence now, the money later; no transaction code.
  const credit = method === "credit"
  const needsCode = PAYMENT_METHODS.find(m => m.value === method)?.needsCode ?? false

  const newExpiry: Date | null = useMemo(() => {
    if (!target) return null
    if (mode === "days") return days >= 1 ? expiryAfter(target.expiry, days) : null
    return date ? new Date(date) : null
  }, [target, mode, days, date])
  const shortening = !!(target?.expiry && newExpiry && newExpiry.getTime() < new Date(target.expiry).getTime())
  // Money that comes in now (not free, not "not paid yet") can count in another month.
  const choosesMonth = !free && !credit
  const periodDays = mode === "days"
    ? days
    : newExpiry ? Math.ceil((newExpiry.getTime() - Math.max(target?.expiry ? new Date(target.expiry).getTime() : Date.now(), Date.now())) / 86_400_000) : 0
  const periodMonths = monthsBought({ days_added: periodDays })
  const incomeNote = periodMonths > 1
    ? `Received today, spread over ${periodMonths} months from ${monthLabel(incomeMonth)}.`
    : incomeMonth === thisMonth ? "Received today, counted in this month's income." : `Received today, counted in ${monthLabel(incomeMonth)}'s income.`

  // Said before the server is asked, in the same words it would refuse with.
  const problem = (() => {
    if (!newExpiry) return mode === "date" ? "Choose the new expiry date." : "Choose how many days."
    if (newExpiry.getTime() <= Date.now()) return "The new expiry date must be in the future."
    if (shortening && (!free || !note.trim())) return "That date is earlier than the current expiry: a correction. Choose “Free” and say why in the note."
    if (!free && !(Number(amount) > 0)) return credit ? "Enter the amount agreed (what they will pay)." : "Enter the amount paid, or choose “Free”."
    if (needsCode && !reference.trim()) return `Enter the ${methodLabel(method)} transaction code.`
    if (free && !note.trim()) return "Say why this extension is free (in the note)."
    return null
  })()

  if (!target) return null
  const minDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  const submit = async () => {
    if (problem) { setError(problem); return }
    setBusy(true)
    setError(null)
    try {
      const res = await renewLicence({
        shopId: target.id,
        days: mode === "days" ? days : undefined,
        newExpiry: mode === "date" ? newExpiry!.toISOString() : undefined,
        amount: free ? 0 : Number(amount),
        method,
        reference: needsCode || method === "bank" ? reference : undefined,
        note,
      })
      // Paid for another month: the month is set just after (superadmin_set_income_month).
      let countedIn = ""
      if (choosesMonth && incomeMonth !== thisMonth) {
        try {
          await setIncomeMonth(res.payment.id, incomeMonth)
          countedIn = periodMonths > 1 ? `, counted from ${monthLabel(incomeMonth)}` : `, counted in ${monthLabel(incomeMonth)}`
        } catch (err: any) {
          toast.error(`The payment is recorded, but it counts in ${monthLabel(thisMonth)}: ${err?.message ?? ""} Use “Move month” on it to change that.`)
        }
      }
      toast.success(`${target.name}: licence now runs to ${formatDate(res.licence.expiry_date)}${free ? "" : credit
        ? ` (${formatTZS(Number(res.payment.amount))} owed: press “Record payment” on it when they pay)`
        : ` (${formatTZS(Number(res.payment.amount))} recorded${countedIn})`}.`)
      if (res.licence.status === "blocked") toast("This licence is marked blocked: its shop stays read-only until the licence is unblocked.")
      if (smsOn && sendSms && contact?.phone) {
        const sms = await sendRenewalSms(res.payment.id)
        if (sms.ok) toast.success(sms.message)
        else toast.error(sms.message)
      }
      onDone()
      onClose()
    } catch (err: any) {
      setError(err?.message || "The renewal failed. Nothing was changed.")
    } finally {
      setBusy(false)
    }
  }

  const currentDays = target.expiry ? daysFromNow(target.expiry) : null

  return (
    <Modal isOpen={!!target} onClose={busy ? () => {} : onClose} title={`Renew licence: ${target.name}`} className="max-w-lg">
      <div className="space-y-5" data-testid="renew-modal">
        <p className="text-sm text-slate-600">
          {target.expiry
            ? <>Current expiry: <strong>{formatDate(target.expiry)}</strong> ({currentDays! < 0 ? `expired ${describeDays(currentDays!)}` : `ends ${describeDays(currentDays!)}`}).</>
            : <>This shop has <strong>no licence</strong> yet.</>}
          {target.lastPayment && (
            <> Last payment: {formatTZS(Number(target.lastPayment.amount))} for {target.lastPayment.days_added} days ({methodLabel(target.lastPayment.method)}, {formatDate(target.lastPayment.settled_at || target.lastPayment.created_at)}).</>
          )}
        </p>
        {target.owed && target.owed.count > 0 && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="renew-already-owed">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This shop already owes <strong>{formatTZS(target.owed.amount)}</strong> for {target.owed.count === 1 ? "a renewal" : `${target.owed.count} renewals`} made before payment (since {formatDate(target.owed.since)}).</span>
          </p>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">How long</label>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setMode("days"); setDays(p) }}
                className={cn("rounded-md border px-3 py-1.5 text-sm", mode === "days" && days === p ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 hover:bg-slate-50")}
              >
                {p === 365 ? "1 year" : `${p} days`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMode("date")}
              className={cn("rounded-md border px-3 py-1.5 text-sm", mode === "date" ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 hover:bg-slate-50")}
            >
              Pick a date
            </button>
          </div>
          {mode === "date" && (
            <Input type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} aria-label="New expiry date" />
          )}
          {newExpiry && newExpiry.getTime() > Date.now() && (
            <p className={cn("text-sm", shortening ? "text-amber-700" : "text-slate-600")}>
              New expiry: <strong>{formatDate(newExpiry.toISOString())}</strong>
              {mode === "days" && target.expiry && currentDays! >= 0 && " (added on to the current expiry)"}
              {mode === "days" && (!target.expiry || currentDays! < 0) && " (counted from today)"}
              {shortening && " — earlier than now: a correction"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="renew-method">Paid by</label>
            <select
              id="renew-method"
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="renew-amount">{credit ? "Amount agreed (TSh)" : "Amount (TSh)"}</label>
            <Input
              id="renew-amount"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder={free ? "0" : "e.g. 15000"}
              value={free ? "" : amount}
              disabled={free}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        {(needsCode || method === "bank") && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="renew-code">
              Transaction code {method === "bank" && <span className="font-normal text-slate-400">(optional)</span>}
            </label>
            <Input id="renew-code" placeholder="e.g. SK47AB9XQ" value={reference} onChange={e => setReference(e.target.value)} className="font-mono uppercase placeholder:normal-case placeholder:font-sans" />
            <p className="text-xs text-slate-500">A code can be recorded only once, so the same payment is never counted twice.</p>
          </div>
        )}

        {choosesMonth && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Count as income in</label>
            <IncomeMonthPicker value={incomeMonth} onChange={setIncomeMonth_} received={thisMonth} />
            <p className="text-xs text-slate-500" data-testid="income-month-line">{incomeNote}</p>
          </div>
        )}

        {credit && (
          <p className="flex items-start gap-2 rounded-md bg-sky-50 p-3 text-sm text-sky-900" data-testid="renew-credit-info">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The licence is extended now. {Number(amount) > 0 ? formatTZS(Number(amount)) : "The amount"} is recorded as <strong>owed</strong>, with no transaction code,
              and is not counted as income yet. When they pay, press <strong>Record payment</strong> on it under “Not paid yet” in Licences & Payments.
            </span>
          </p>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="renew-note">
            Note {!free && <span className="font-normal text-slate-400">(optional)</span>}
          </label>
          <Input id="renew-note" placeholder={free ? "Why is this free?" : credit ? "e.g. will pay on Friday" : "e.g. paid by the owner's brother"} value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {!smsOn ? (
          <p className="flex items-center gap-2 text-xs text-slate-500" data-testid="sms-off">
            <MessageSquare className="h-3.5 w-3.5" />
            Owner SMS is off. It can be switched on in Settings.
          </p>
        ) : (
        <div className="rounded-lg border border-slate-200 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={sendSms && !!contact?.phone} disabled={!contact?.phone} onChange={e => setSendSms(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
            <MessageSquare className="h-4 w-4 text-slate-400" />
            Send the owner an SMS
            {contact?.phone && <span className="font-normal text-slate-500">to {contact.name} · {formatTzPhone(contact.phone)}</span>}
          </label>
          {contact?.phone
            ? newExpiry && <p className="rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600" data-testid="sms-preview">{renewalSmsText(target.name, newExpiry)}</p>
            : <p className="text-xs text-amber-700">The owner has no phone number on file, so no SMS can be sent.</p>}
        </div>
        )}

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
            Confirm renewal
          </Button>
        </div>
      </div>
    </Modal>
  )
}
