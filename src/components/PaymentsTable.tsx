import { useState } from "react"
import { CalendarClock, Clock, Loader2, Send, Wallet } from "lucide-react"
import { Badge } from "@/src/components/ui/Badge"
import { Button } from "@/src/components/ui/Button"
import { toast } from "@/src/components/ui/Toaster"
import { useRenewalSms } from "@/src/lib/settings"
import { SettlePaymentModal } from "@/src/components/SettlePaymentModal"
import { MoveIncomeModal } from "@/src/components/MoveIncomeModal"
import {
  type LicencePayment, formatDate, formatTZS, incomeStart, isMoney, isMovedIncome, isOwed, methodLabel, monthLabel, monthsBought,
  sendRenewalSms, smsBadge,
} from "@/src/lib/licences"

/**
 * The payments log: newest first, with the owner's SMS and a way to resend it.
 * A renewal made before payment shows as owed, with "Record payment".
 */
export function PaymentsTable({
  payments, shopNames, shopName, showShop = true, onChanged, pageSize = 50, empty = "No payments recorded yet.",
}: {
  payments: LicencePayment[]
  shopNames?: Map<string, string>
  /** The shop's name when every row is the same shop. */
  shopName?: string
  showShop?: boolean
  onChanged?: () => void
  pageSize?: number
  empty?: string
}) {
  const [shown, setShown] = useState(pageSize)
  const [sending, setSending] = useState<string | null>(null)
  const [settling, setSettling] = useState<LicencePayment | null>(null)
  const [moving, setMoving] = useState<LicencePayment | null>(null)
  const nameOf = (p: LicencePayment) => shopNames?.get(p.shop_id) ?? shopName
  // Send / Resend only while "Owner SMS on renewal" is on in Settings.
  const smsOn = useRenewalSms() === true

  const resend = async (p: LicencePayment) => {
    setSending(p.id)
    try {
      const outcome = await sendRenewalSms(p.id, p.sms_status === "sent")
      if (outcome.ok) toast.success(outcome.message)
      else toast.error(outcome.message)
      onChanged?.()
    } finally {
      setSending(null)
    }
  }

  if (payments.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>
  }

  const amountOf = (p: LicencePayment) => p.method === "free"
    ? <span className="text-slate-400">Free</span>
    : <span className={isOwed(p) ? "text-amber-700" : undefined}>
        {formatTZS(Number(p.amount))}
        {/* Counted as income a share at a time (lib/licences.ts: incomeShares). */}
        {monthsBought(p) > 1 && <span className="block text-[11px] font-normal text-slate-500">spread over {monthsBought(p)} months{isMovedIncome(p) && ` from ${monthLabel(incomeStart(p), "short")}`}</span>}
      </span>

  /** Owed: the badge and the button. Paid later: when the money came. */
  const owedOf = (p: LicencePayment, compact = false) => isOwed(p) ? (
    <div className={compact ? "flex items-center justify-between gap-2" : "mt-1 flex flex-wrap items-center gap-2"}>
      <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Not paid yet</Badge>
      <Button size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={() => setSettling(p)} data-testid="settle-button">
        <Wallet className="h-3 w-3" />Record payment
      </Button>
    </div>
  ) : p.settled_at ? (
    <div className="text-xs text-emerald-700">Paid later, on {formatDate(p.settled_at)}</div>
  ) : null

  /** Money received: the month it counts in when moved, and "Move month". */
  const incomeOf = (p: LicencePayment, compact = false) => isMoney(p) ? (
    <div className={compact ? "flex items-center justify-between gap-2" : "mt-1 flex flex-wrap items-center gap-2"}>
      {isMovedIncome(p)
        ? <Badge variant="secondary" className="bg-indigo-50 text-indigo-700" data-testid="income-moved-badge">
            {monthsBought(p) > 1 ? `Counts from ${monthLabel(incomeStart(p), "short")}` : `Counts in ${monthLabel(incomeStart(p), "short")}`}
          </Badge>
        : <span />}
      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setMoving(p)} data-testid="move-income-button" title="Count this payment in another month">
        <CalendarClock className="h-3 w-3" />Move month
      </Button>
    </div>
  ) : null

  return (
    <div className="space-y-3">
      {/* On a phone: one card per payment. */}
      <ul className="space-y-2 md:hidden" data-testid="payments-cards">
        {payments.slice(0, shown).map(p => {
          const sms = smsBadge(p.sms_status)
          const correction = p.days_added < 0
          return (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showShop && <p className="truncate font-semibold text-slate-900">{shopNames?.get(p.shop_id) ?? p.shop_id.slice(0, 8)}</p>}
                  <p className="text-xs text-slate-500">{formatDate(p.created_at)} · {methodLabel(p.method)}{p.reference && <> · <span className="font-mono">{p.reference}</span></>}</p>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">{amountOf(p)}</p>
              </div>
              <p className={`mt-1 text-xs ${correction ? "text-amber-700" : "text-slate-600"}`}>
                {correction ? `Corrected (${p.days_added} days)` : `+${p.days_added} days`} → {formatDate(p.new_expiry)}
                {p.note && <span className="italic text-slate-500"> · {p.note}</span>}
              </p>
              {(isOwed(p) || p.settled_at) && <div className="mt-2">{owedOf(p, true)}</div>}
              {isMoney(p) && <div className="mt-2">{incomeOf(p, true)}</div>}
              <div className="mt-2 flex items-center justify-between">
                <Badge variant={sms.variant}>{sms.label}</Badge>
                {smsOn && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" disabled={sending === p.id} onClick={() => resend(p)}>
                    {sending === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {p.sms_status === "sent" ? "Resend SMS" : "Send SMS"}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
        <table className="w-full text-sm text-left" data-testid="payments-table">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 font-medium">Date</th>
              {showShop && <th className="px-3 py-2.5 font-medium">Shop</th>}
              <th className="px-3 py-2.5 font-medium text-right">Amount</th>
              <th className="px-3 py-2.5 font-medium">Paid by</th>
              <th className="px-3 py-2.5 font-medium">Period</th>
              <th className="px-3 py-2.5 font-medium">Owner SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {payments.slice(0, shown).map(p => {
              const sms = smsBadge(p.sms_status)
              const correction = p.days_added < 0
              return (
                <tr key={p.id} className="align-top hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{formatDate(p.created_at)}</td>
                  {showShop && <td className="px-3 py-2.5 font-medium text-slate-900">{shopNames?.get(p.shop_id) ?? p.shop_id.slice(0, 8)}</td>}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium text-slate-900">
                    {amountOf(p)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <div>{methodLabel(p.method)}</div>
                    {p.reference && <div className="font-mono text-xs text-slate-500">{p.reference}</div>}
                    {p.note && <div className="text-xs text-slate-500 italic">{p.note}</div>}
                    {owedOf(p)}
                    {incomeOf(p)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    <div className={correction ? "text-amber-700" : undefined}>
                      {correction ? `Corrected (${p.days_added} days)` : `+${p.days_added} days`}
                    </div>
                    <div className="text-xs text-slate-500">to {formatDate(p.new_expiry)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={sms.variant}>{sms.label}</Badge>
                      {smsOn && <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={sending === p.id}
                        onClick={() => resend(p)}
                        title={p.sms_status === "sent" ? "Send the SMS again" : "Send the SMS"}
                      >
                        {sending === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        {p.sms_status === "sent" ? "Resend" : "Send"}
                      </Button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {payments.length > shown && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setShown(s => s + pageSize)}>
            Show {Math.min(pageSize, payments.length - shown)} more
          </Button>
        </div>
      )}
      <MoveIncomeModal
        payment={moving}
        shopName={moving ? nameOf(moving) : undefined}
        onClose={() => setMoving(null)}
        onDone={() => onChanged?.()}
      />
      <SettlePaymentModal
        payment={settling}
        shopName={settling ? nameOf(settling) : undefined}
        onClose={() => setSettling(null)}
        onDone={() => onChanged?.()}
      />
    </div>
  )
}
