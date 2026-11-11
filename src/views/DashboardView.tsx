import { useEffect, useState } from "react"
import { AlertCircle, CalendarClock, Loader2, RefreshCw, Store, TrendingUp, UserMinus, Users, Wallet, Activity, ShoppingBag } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { Stat } from "@/src/components/ui/Stat"
import { formatDate, formatTZS } from "@/src/lib/licences"
import { type Overview, loadOverview, monthShort, percent } from "@/src/lib/overview"

/**
 * Venics at a glance: the licence business (who pays, who is on trial, how
 * trials turn into paying shops, the month's income, renewals due, shops
 * lost), then how much the shops are using the app. One server call
 * (superadmin_overview), no sales downloaded into the browser.
 */
export function DashboardView({ onOpen }: { onOpen?: (view: string) => void }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loadOverview())
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" })
  const s = data?.shops
  const inc = data?.income
  const act = data?.activity
  const openLicences = onOpen ? { label: "Open Licences & Payments", onClick: () => onOpen("licences") } : undefined
  const chart = (inc?.months ?? []).map(m => ({ name: monthShort(m.month), amount: m.amount }))
  const firstPayment = inc?.first_payment_at

  const breakdown: { label: string; value: number | undefined; dot: string; note?: string }[] = [
    { label: "Paying", value: s?.paying, dot: "bg-emerald-500" },
    { label: "On trial", value: s?.trial, dot: "bg-sky-500" },
    { label: "Trial ended, never paid", value: s?.trial_ended, dot: "bg-slate-300" },
    { label: "Lost (paid, ended over 30 days ago)", value: s?.lost, dot: "bg-red-500", note: s ? `${s.lost_90d} in the last 90 days` : undefined },
    { label: "Licence blocked", value: s?.blocked, dot: "bg-red-300" },
    { label: "No licence (e.g. a second branch)", value: s?.no_licence, dot: "bg-amber-400" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Venics at a glance</h2>
          <p className="text-slate-500">
            Your licence business first, then how much the shops use the app.
            {data && <> Updated {new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</>}
          </p>
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
        <Stat title={`Licence income (${monthName})`} icon={Wallet} tone="emerald"
          value={inc ? formatTZS(inc.this_month) : "…"}
          sub={inc ? `${inc.payments_this_month} payment${inc.payments_this_month === 1 ? "" : "s"} · last month ${formatTZS(inc.last_month)}` : undefined} />
        <Stat title="Paying shops" icon={Store} tone="indigo"
          value={s ? s.paying.toLocaleString() : "…"}
          sub={s ? `+ ${s.trial.toLocaleString()} on trial · ${s.total.toLocaleString()} shops in all` : undefined} />
        <Stat title="Trials that became paying" icon={TrendingUp} tone="emerald"
          value={s ? percent(s.converted_90d, s.trials_90d) : "…"}
          sub={s ? `${s.converted_90d} of ${s.trials_90d} shops that started in the last 90 days · ${percent(s.converted_all, s.trials_all)} of all` : undefined} />
        <Stat title="Renewals due" icon={CalendarClock} tone="amber"
          value={s ? (s.ending_7d + s.ended_30d).toLocaleString() : "…"}
          sub={s ? `${s.ending_7d} ending in 7 days · ${s.ended_30d} ended in the last 30` : undefined}
          action={openLicences} />
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Licence income per month</CardTitle>
            <CardDescription>
              Money received for licences (free extensions not counted).
              {firstPayment
                ? <> Recorded from {formatDate(firstPayment)}: earlier months only count from then.</>
                : <> No payments recorded yet: they appear here as licences are renewed.</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full" data-testid="income-chart">
              {chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} width={56}
                      tickFormatter={(v: number) => (v >= 1_000_000 ? `${v / 1_000_000}M` : v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      formatter={(v: number) => [formatTZS(v), "Licence income"]} />
                    <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">{loading ? "Loading…" : "No figures yet."}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Shops by licence</CardTitle>
            <CardDescription>Where every shop stands today.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100" data-testid="licence-breakdown">
              {breakdown.map(b => (
                <li key={b.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.dot}`} />
                    <span>
                      {b.label}
                      {b.note && <span className="block text-xs text-slate-400">{b.note}</span>}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-900">{b.value?.toLocaleString() ?? "…"}</span>
                </li>
              ))}
            </ul>
            {openLicences && (
              <button onClick={openLicences.onClick} className="mt-3 text-xs font-medium text-indigo-600 hover:underline">
                Who to call about renewals →
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">How much the shops use Venics</h3>
        {data && !act ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500" data-testid="no-activity">
            Shop activity appears here once 20261104_sales_daily_and_history.sql has been run on Supabase.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat title="Shops selling today" icon={Activity} value={act ? act.shops_today.toLocaleString() : "…"}
              sub={s && act ? `of ${s.paying + s.trial} with a working licence` : undefined} />
            <Stat title="Shops selling this week" icon={Store} value={act ? act.shops_7d.toLocaleString() : "…"} sub="At least one sale in the last 7 days" />
            <Stat title="Staff selling today" icon={Users} value={act ? act.users_today.toLocaleString() : "…"} sub="People who recorded a sale today" />
            <Stat title={`Shops' sales (${monthName})`} icon={ShoppingBag} value={act ? formatTZS(act.sales_this_month) : "…"}
              sub="Your customers' takings through Venics, not your income" />
          </div>
        )}
      </div>

      {s && s.lost_90d > 0 && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <UserMinus className="h-4 w-4 text-red-500" />
          {s.lost_90d} paying shop{s.lost_90d === 1 ? "" : "s"} stopped renewing in the last 90 days.
        </p>
      )}
    </div>
  )
}
