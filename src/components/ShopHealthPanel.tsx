import { useEffect, useState } from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Monitor, RefreshCw, Smartphone, Wifi } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Badge } from "@/src/components/ui/Badge"
import { Button } from "@/src/components/ui/Button"
import { formatTzPhone } from "@/src/lib/utils"
import { formatDate, formatTZS } from "@/src/lib/licences"
import {
  type ShopHealth, ago, buildDate, describeUnsent, deviceName, findProblems, licenceStateLabel, loadShopHealth,
} from "@/src/lib/health"

/** Everything about one shop that helps when its boss calls. */
export function ShopHealthPanel({ shopId }: { shopId: string }) {
  const [health, setHealth] = useState<ShopHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setHealth(await loadShopHealth(shopId))
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { setHealth(null); load() }, [shopId])

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
      </div>
    )
  }
  if (!health) {
    return <div className="flex items-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Checking the shop…</div>
  }

  const problems = findProblems(health)
  const lic = health.licence
  const s = health.server

  return (
    <div className="space-y-5" data-testid="shop-health">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{health.shop.name}</h3>
          <p className="text-sm text-slate-500">
            Joined {formatDate(health.shop.created_at)} · {health.people.length} {health.people.length === 1 ? "person" : "people"} · {health.devices.length} device{health.devices.length === 1 ? "" : "s"} reporting
            · checked {new Date(health.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Check again
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">What needs attention</CardTitle></CardHeader>
        <CardContent>
          {problems.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700" data-testid="no-problems"><CheckCircle2 className="h-4 w-4" />Nothing looks wrong.</p>
          ) : (
            <ul className="space-y-2.5" data-testid="problems">
              {problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  {p.level === "red"
                    ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                  <div>
                    <p className="text-slate-900">{p.text}</p>
                    {p.hint && <p className="mt-0.5 break-words text-xs text-slate-500">{p.hint}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Licence</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm text-slate-700">
            {lic ? (
              <>
                <p>
                  {new Date(lic.expiry_date).getTime() <= Date.now()
                    ? <>Ended <strong>{formatDate(lic.expiry_date)}</strong> ({ago(lic.expiry_date)})</>
                    : <>Ends <strong>{formatDate(lic.expiry_date)}</strong> (in {Math.ceil((new Date(lic.expiry_date).getTime() - Date.now()) / 86_400_000)} days)</>}
                </p>
                <p className="flex flex-wrap gap-1.5">
                  <Badge variant={lic.status === "active" ? "success" : "destructive"}>{lic.status}</Badge>
                  <Badge variant="secondary">{lic.is_trial === false ? "Paid" : "Trial or not yet paid"}</Badge>
                </p>
              </>
            ) : <p className="text-red-700">No licence.</p>}
            {health.payments && (
              <p className="text-slate-500">
                {health.payments.count} payment{health.payments.count === 1 ? "" : "s"}, {formatTZS(Number(health.payments.total))} in all
                {health.payments.last_at && <> · last {formatTZS(Number(health.payments.last_amount))} on {formatDate(health.payments.last_at)}</>}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">On the server</CardTitle>
            <CardDescription>What has reached Supabase, whatever the devices say.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-slate-700">
            <p>Last sale made: <strong>{s.last_sale_at ? formatDate(s.last_sale_at) : "none"}</strong>{s.last_sale_at && ` (${ago(s.last_sale_at)})`}</p>
            <p>Last sale received: <strong>{s.last_received_at ? ago(s.last_received_at) : "never"}</strong></p>
            <p>Sales in the last 30 days: <strong>{s.sales_30d.toLocaleString()}</strong>
              {s.sales_without_items > 0 && <span className="text-red-700"> · {s.sales_without_items} without their items</span>}</p>
            <p>Products: <strong>{s.products.toLocaleString()}</strong></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Devices</CardTitle>
          <CardDescription>Each device reports after it syncs. Devices on older app versions do not report.</CardDescription>
        </CardHeader>
        <CardContent>
          {health.devices.length === 0 ? (
            <p className="text-sm text-slate-500">No device has reported yet.</p>
          ) : (
            <>
            {/* On a phone: one card per device. */}
            <ul className="space-y-2 md:hidden" data-testid="device-cards">
              {health.devices.map(d => (
                <li key={d.device_id + d.user_id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                        {d.app === "mobile" ? <Smartphone className="h-4 w-4 text-slate-400" /> : <Monitor className="h-4 w-4 text-slate-400" />}
                        <span className="truncate">{deviceName(d)}</span>
                      </p>
                      <p className="text-xs text-slate-500">online {ago(d.reported_at)} · {d.platform ?? "?"}{d.hub ? " · Kituo" : ""}</p>
                    </div>
                    {d.sync_ok === false ? <Badge variant="destructive">Failing</Badge> : <Badge variant="success">OK</Badge>}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-slate-500">Waiting to send</dt>
                    <dd className={d.unsent_total > 0 ? "font-medium text-slate-900" : "text-slate-500"}>
                      {d.unsent_total === 0 ? "Nothing" : `${describeUnsent(d.unsent)}${d.oldest_unsent_at ? `, oldest ${ago(d.oldest_unsent_at)}` : ""}`}
                    </dd>
                    <dt className="text-slate-500">Last complete sync</dt><dd className="text-slate-700">{ago(d.last_sync_at)}</dd>
                    <dt className="text-slate-500">Version</dt>
                    <dd className="text-slate-700">{buildDate(d.app_build)}{d.native_version && ` · app ${d.native_version}`}{d.behind && <span className="ml-1 font-medium text-amber-700">· update</span>}</dd>
                    <dt className="text-slate-500">Licence on device</dt><dd className="text-slate-700">{licenceStateLabel(d.licence_state)}</dd>
                  </dl>
                  {d.last_error && <p className="mt-2 break-words rounded bg-red-50 p-2 text-xs text-red-700">{d.last_error}</p>}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
              <table className="w-full text-sm text-left" data-testid="devices">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Device</th>
                    <th className="px-3 py-2.5 font-medium">Last online</th>
                    <th className="px-3 py-2.5 font-medium">Sync</th>
                    <th className="px-3 py-2.5 font-medium">Waiting to send</th>
                    <th className="px-3 py-2.5 font-medium">Version</th>
                    <th className="px-3 py-2.5 font-medium">Licence on device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {health.devices.map(d => (
                    <tr key={d.device_id + d.user_id} className="align-top">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          {d.app === "mobile" ? <Smartphone className="h-3.5 w-3.5 text-slate-400" /> : <Monitor className="h-3.5 w-3.5 text-slate-400" />}
                          {deviceName(d)}
                        </div>
                        <div className="text-xs text-slate-500">{d.app === "mobile" ? "Mobile" : "Desktop"} · {d.platform ?? "?"}{d.hub && <> · <Wifi className="inline h-3 w-3" /> Kituo</>}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{ago(d.reported_at)}</td>
                      <td className="px-3 py-2.5">
                        {d.sync_ok === false ? <Badge variant="destructive">Failing</Badge> : <Badge variant="success">OK</Badge>}
                        <div className="mt-1 text-xs text-slate-500">last complete {ago(d.last_sync_at)}</div>
                        {d.last_error && <div className="mt-1 max-w-[16rem] break-words text-xs text-red-700">{d.last_error}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        {d.unsent_total === 0 ? <span className="text-slate-500">Nothing</span> : (
                          <>
                            <div className="font-medium text-slate-900">{d.unsent_total} item{d.unsent_total === 1 ? "" : "s"}</div>
                            <div className="text-xs text-slate-500">{describeUnsent(d.unsent)}</div>
                            {d.oldest_unsent_at && <div className="text-xs text-slate-500">oldest {ago(d.oldest_unsent_at)}</div>}
                            {d.unsent_on_hub > 0 && <div className="text-xs text-slate-500">{d.unsent_on_hub} safe on Kituo</div>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-slate-700">{buildDate(d.app_build)}</div>
                        {d.native_version && <div className="text-xs text-slate-500">app {d.native_version}</div>}
                        {d.behind && <Badge variant="warning">Update needed</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{licenceStateLabel(d.licence_state)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">People</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-100 text-sm" data-testid="people">
            {health.people.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <span className="text-slate-500"> · {p.role}{p.id === health.shop.created_by ? " (owner)" : ""}</span>
                  {p.elsewhere && <span className="text-xs text-slate-400"> · signed in to another of their shops now</span>}
                  {p.status === "blocked" && <Badge variant="destructive" className="ml-2">Blocked</Badge>}
                </span>
                <span className="text-xs text-slate-500">
                  {p.phone ? <a className="text-indigo-600 hover:underline" href={`tel:+${p.phone.replace(/^\+/, "")}`}>{formatTzPhone(p.phone)}</a> : p.email ?? "no phone"}
                  {p.last_seen && <> · seen {ago(p.last_seen)}</>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
