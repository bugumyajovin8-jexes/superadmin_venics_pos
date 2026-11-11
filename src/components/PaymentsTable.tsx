import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Badge } from "@/src/components/ui/Badge"
import { Button } from "@/src/components/ui/Button"
import { toast } from "@/src/components/ui/Toaster"
import { useRenewalSms } from "@/src/lib/settings"
import { type LicencePayment, formatDate, formatTZS, methodLabel, sendRenewalSms, smsBadge } from "@/src/lib/licences"

/** The payments log: newest first, with the owner's SMS and a way to resend it. */
export function PaymentsTable({
  payments, shopNames, showShop = true, onChanged, pageSize = 50,
}: {
  payments: LicencePayment[]
  shopNames?: Map<string, string>
  showShop?: boolean
  onChanged?: () => void
  pageSize?: number
}) {
  const [shown, setShown] = useState(pageSize)
  const [sending, setSending] = useState<string | null>(null)
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
    return <p className="py-8 text-center text-sm text-slate-500">No payments recorded yet.</p>
  }

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
                <p className="shrink-0 font-semibold text-slate-900">{p.method === "free" ? <span className="text-slate-400">Free</span> : formatTZS(Number(p.amount))}</p>
              </div>
              <p className={`mt-1 text-xs ${correction ? "text-amber-700" : "text-slate-600"}`}>
                {correction ? `Corrected (${p.days_added} days)` : `+${p.days_added} days`} → {formatDate(p.new_expiry)}
                {p.note && <span className="italic text-slate-500"> · {p.note}</span>}
              </p>
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
                    {p.method === "free" ? <span className="text-slate-400">Free</span> : formatTZS(Number(p.amount))}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <div>{methodLabel(p.method)}</div>
                    {p.reference && <div className="font-mono text-xs text-slate-500">{p.reference}</div>}
                    {p.note && <div className="text-xs text-slate-500 italic">{p.note}</div>}
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
    </div>
  )
}
