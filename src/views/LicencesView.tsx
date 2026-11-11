import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarClock, Gift, Loader2, Phone, RefreshCw, Wallet, CalendarX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Stat } from "@/src/components/ui/Stat"
import { Badge } from "@/src/components/ui/Badge"
import { Button } from "@/src/components/ui/Button"
import { usePageSearch } from "@/src/lib/search"
import { PaymentsTable } from "@/src/components/PaymentsTable"
import { RenewLicenceModal, type RenewTarget } from "@/src/components/RenewLicenceModal"
import { formatTzPhone } from "@/src/lib/utils"
import {
  type LicencePayment, type LicenceShop,
  contactFor, daysFromNow, describeDays, explainError, formatDate, formatTZS,
  incomeSummary, loadLicenceShops, loadPayments, renewalsDue, shopMatches,
} from "@/src/lib/licences"

export function LicencesView() {
  const [shops, setShops] = useState<LicenceShop[]>([])
  const [payments, setPayments] = useState<LicencePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The header's search bar: narrows the renewals and the payments below.
  const search = usePageSearch()
  const [renewing, setRenewing] = useState<RenewTarget | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, p] = await Promise.all([loadLicenceShops(), loadPayments()])
      setShops(s)
      setPayments(p)
    } catch (err) {
      setError(explainError(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const income = useMemo(() => incomeSummary(payments), [payments])
  // The figures count every shop; the lists show what the search matches.
  const due = useMemo(() => renewalsDue(shops), [shops])
  const matching = useMemo(() => shops.filter(s => shopMatches(s, search)), [shops, search])
  const dueShown = useMemo(() => (search.trim() ? renewalsDue(matching) : due), [search, matching, due])
  const shopNames = useMemo(() => new Map(shops.map(s => [s.id, s.name])), [shops])
  const lastPaid = useMemo(() => {
    const m = new Map<string, LicencePayment>()
    for (const p of payments) if (p.method !== "free" && !m.has(p.shop_id)) m.set(p.shop_id, p)
    return m
  }, [payments])

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return payments
    const shopIds = new Set(matching.map(s => s.id))
    return payments.filter(p =>
      shopIds.has(p.shop_id)
      || (p.reference ?? "").toLowerCase().includes(q)
      || (p.note ?? "").toLowerCase().includes(q))
  }, [payments, search, matching])

  const renew = (s: LicenceShop) => setRenewing({
    id: s.id, name: s.name, created_by: s.created_by, owners: s.owners,
    expiry: s.licence?.expiry_date ?? null, licenceStatus: s.licence?.status, lastPayment: lastPaid.get(s.id) ?? null,
  })

  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" })

  const DueTable = ({ rows, empty }: { rows: LicenceShop[]; empty: string }) => (
    rows.length === 0 ? <p className="py-4 text-sm text-slate-500">{empty}</p> : (
      <>
      {/* On a phone: a card per shop, with the call and the renewal a thumb away. */}
      <ul className="space-y-3 md:hidden">
        {rows.map(s => {
          const contact = contactFor(s)
          const days = daysFromNow(s.licence!.expiry_date)
          const last = lastPaid.get(s.id)
          return (
            <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="due-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  <p className="text-sm text-slate-600">{contact?.name || s.owner_name || "—"}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Badge variant={s.licence!.is_trial ? "secondary" : "success"}>{s.licence!.is_trial ? "Trial" : "Paid"}</Badge>
                  {s.licence!.status === "blocked" && <Badge variant="destructive">Blocked</Badge>}
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                <span className={days < 0 ? "font-medium text-red-600" : days <= 2 ? "font-medium text-amber-700" : "text-slate-700"}>
                  {days < 0 ? `Ended ${describeDays(days)}` : `Ends ${describeDays(days)}`} · {formatDate(s.licence!.expiry_date)}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{last ? `Last ${formatTZS(Number(last.amount))}` : "Never paid"}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {contact?.phone ? (
                  <a href={`tel:+${contact.phone.replace(/^\+/, "")}`} className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-sm font-medium text-indigo-700 active:bg-slate-50">
                    <Phone className="h-4 w-4" />{formatTzPhone(contact.phone)}
                  </a>
                ) : (
                  <span className="flex h-10 items-center justify-center rounded-lg border border-dashed border-slate-200 px-2 text-center text-xs text-amber-700">
                    {contact?.email ? "Email only" : "No phone"}
                  </span>
                )}
                <Button className="h-10" onClick={() => renew(s)}>Renew</Button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 font-medium">Shop</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Licence ends</th>
              <th className="px-3 py-2.5 font-medium">Last payment</th>
              <th className="px-3 py-2.5 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(s => {
              const contact = contactFor(s)
              const days = daysFromNow(s.licence!.expiry_date)
              const last = lastPaid.get(s.id)
              return (
                <tr key={s.id} className="hover:bg-slate-50/50" data-testid="due-row">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <div className="mt-0.5 flex gap-1">
                      <Badge variant={s.licence!.is_trial ? "secondary" : "success"}>{s.licence!.is_trial ? "Trial" : "Paid"}</Badge>
                      {s.licence!.status === "blocked" && <Badge variant="destructive">Licence blocked</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <div>{contact?.name || s.owner_name || "—"}</div>
                    {contact?.phone
                      ? <a href={`tel:+${contact.phone.replace(/^\+/, "")}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"><Phone className="h-3 w-3" />{formatTzPhone(contact.phone)}</a>
                      : <span className="text-xs text-amber-700">{contact?.email ? `Email only: ${contact.email}` : "No phone on file"}</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="text-slate-900">{formatDate(s.licence!.expiry_date)}</div>
                    <div className={`text-xs ${days < 0 ? "text-red-600" : days <= 2 ? "text-amber-700" : "text-slate-500"}`}>{days < 0 ? `ended ${describeDays(days)}` : `ends ${describeDays(days)}`}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    {last ? <><div>{formatTZS(Number(last.amount))}</div><div className="text-xs text-slate-500">{formatDate(last.created_at)}</div></> : <span className="text-slate-400">Never paid</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" className="h-8 text-xs" onClick={() => renew(s)}>Renew</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>
    )
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Licences & Payments</h2>
          <p className="text-slate-500">Who needs to renew, what has been paid, and this month's income.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat title={`Income in ${monthName}`} value={formatTZS(income.thisMonth)} icon={Wallet} tone="emerald"
          sub={`${income.paymentsThisMonth} payment${income.paymentsThisMonth === 1 ? "" : "s"} · last month ${formatTZS(income.lastMonth)}`} />
        <Stat title="Ending in 7 days" value={String(due.expiringSoon.length)} icon={CalendarClock} tone="amber" sub="Call them before the shop goes read-only" />
        <Stat title="Ended in the last 30 days" value={String(due.recentlyExpired.length)} icon={CalendarX} tone="red" sub="Read-only now: a call can win them back" />
        <Stat title={`Free in ${monthName}`} value={`${income.freeDaysThisMonth} days`} icon={Gift}
          sub={`${income.freeThisMonth} free extension${income.freeThisMonth === 1 ? "" : "s"}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Renewals due</CardTitle>
          <CardDescription>Every shop here is income waiting: call the owner, then record the payment with Renew.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading licences…</div>
          ) : (
            <>
              <section className="space-y-2" data-testid="due-soon">
                <h3 className="text-sm font-semibold text-slate-700">Ending in the next 7 days ({dueShown.expiringSoon.length})</h3>
                <DueTable rows={dueShown.expiringSoon} empty="No licence ends in the next 7 days." />
              </section>
              <section className="space-y-2" data-testid="due-expired">
                <h3 className="text-sm font-semibold text-slate-700">Ended in the last 30 days ({dueShown.recentlyExpired.length})</h3>
                <DueTable rows={dueShown.recentlyExpired} empty="No licence ended in the last 30 days." />
              </section>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Payments</CardTitle>
          <CardDescription>
            Every renewal, newest first. Free extensions and corrections are listed too.
            {search.trim() && <> Showing {filteredPayments.length} of {payments.length} for “{search.trim()}”.</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading
            ? <div className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading payments…</div>
            : <PaymentsTable payments={filteredPayments} shopNames={shopNames} onChanged={load} />}
        </CardContent>
      </Card>

      <RenewLicenceModal target={renewing} onClose={() => setRenewing(null)} onDone={load} />
    </div>
  )
}
