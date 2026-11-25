import { useEffect, useMemo, useState } from "react"
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Phone, RefreshCw, Store, UserX } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card"
import { Badge } from "@/src/components/ui/Badge"
import { Button } from "@/src/components/ui/Button"
import { Stat } from "@/src/components/ui/Stat"
import { ConfirmDialog } from "@/src/components/ConfirmDialog"
import { toast } from "@/src/components/ui/Toaster"
import { usePageSearch } from "@/src/lib/search"
import { formatTzPhone } from "@/src/lib/utils"
import { formatDate } from "@/src/lib/licences"
import { type MistakenShop, fixMistakenShop, keptBecause, loadMistakenShops, mistakeMatches } from "@/src/lib/mistakenShops"

/**
 * People who opened a shop of their own and were then invited by another
 * shop: almost always staff who signed up before their boss invited them.
 * "Move" removes their empty shop and makes them staff where they were
 * invited. A shop in use (sales, other staff, a payment) is never moved.
 */
export function MistakenShopsView() {
  const [rows, setRows] = useState<MistakenShop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState<MistakenShop | null>(null)
  const [busy, setBusy] = useState(false)
  const search = usePageSearch()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await loadMistakenShops())
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => rows.filter(r => mistakeMatches(r, search)), [rows, search])
  const canMove = rows.filter(r => r.check.can_switch).length

  const move = async () => {
    if (!moving) return
    setBusy(true)
    try {
      const res = await fixMistakenShop(moving.invitation_id)
      toast.success(`${moving.user_name ?? "They"} ${moving.user_name ? "is" : "are"} now staff at ${res.shop_name}. “${res.removed_shop.name}” was removed. Their app switches by itself within 10 minutes.`)
      setMoving(null)
      load()
    } catch (err: any) {
      toast.error(err?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  const what = (r: MistakenShop) => {
    const parts = []
    if (r.check.products) parts.push(`${r.check.products} product${r.check.products === 1 ? "" : "s"}`)
    if (r.check.records) parts.push(`${r.check.records} other record${r.check.records === 1 ? "" : "s"}`)
    return parts.length ? parts.join(", ") : "nothing in it"
  }

  const signupBadge = (r: MistakenShop) =>
    r.signup_role === "employee" ? <Badge variant="secondary">Signed up as staff</Badge>
      : r.signup_role === "boss" ? <Badge variant="secondary">Signed up as owner</Badge>
        : null

  const status = (r: MistakenShop) => r.check.can_switch
    ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Empty: can be moved</Badge>
    : <Badge variant="warning" className="gap-1"><AlertCircle className="h-3 w-3" />Kept: {keptBecause(r.check.reasons)}</Badge>

  const action = (r: MistakenShop, full = false) => r.check.can_switch
    ? <Button size="sm" className={`gap-1 ${full ? "h-10 w-full" : "h-8 text-xs"}`} onClick={() => setMoving(r)} data-testid="move-button">
        Move to {r.inviting_shop_name}<ArrowRight className="h-3 w-3" />
      </Button>
    : <span className="text-xs text-slate-500">Call them: a shop in use is never moved from here.</span>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Mistaken Shops</h2>
          <p className="text-slate-500">Staff who opened a shop of their own before their boss invited them.</p>
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <Stat title="Invited elsewhere" value={loading ? "…" : String(rows.length)} icon={UserX} sub="In a shop of their own, invited by another" />
        <Stat title="Can be moved" value={loading ? "…" : String(canMove)} icon={CheckCircle2} tone="emerald" sub="Their shop is empty" />
        <Stat title="Kept" value={loading ? "…" : String(rows.length - canMove)} icon={Store} tone="amber" sub="Their shop is in use: call them" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invited after opening a shop</CardTitle>
          <CardDescription>
            “Move” removes their empty shop and makes them staff in the shop that invited them, with the same account and password.
            New app versions ask the person themselves; this list is for older versions, and for anyone who said no by mistake.
            {search.trim() && <> Showing {shown.length} of {rows.length} for “{search.trim()}”.</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500" data-testid="mistaken-empty">
              {rows.length ? "Nobody matches the search." : "Nobody is waiting: no one in a shop of their own has been invited by another shop."}
            </p>
          ) : (
            <>
              {/* On a phone: one card per person. */}
              <ul className="space-y-3 md:hidden" data-testid="mistaken-cards">
                {shown.map(r => (
                  <li key={r.invitation_id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{r.user_name ?? "—"}</p>
                        {r.phone && <a href={`tel:+${r.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600"><Phone className="h-3 w-3" />{formatTzPhone(r.phone)}</a>}
                      </div>
                      {signupBadge(r)}
                    </div>
                    <p className="mt-2 text-slate-700">Opened <strong>{r.shop_name}</strong> on {formatDate(r.shop_created_at)} · {what(r)}</p>
                    <p className="text-slate-700">Invited by <strong>{r.inviting_shop_name}</strong> on {formatDate(r.invited_at)}</p>
                    <div className="mt-2">{status(r)}</div>
                    <div className="mt-3">{action(r, true)}</div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
                <table className="w-full text-sm text-left" data-testid="mistaken-table">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Person</th>
                      <th className="px-3 py-2.5 font-medium">Their shop</th>
                      <th className="px-3 py-2.5 font-medium">Invited by</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {shown.map(r => (
                      <tr key={r.invitation_id} className="align-top hover:bg-slate-50/50" data-testid="mistaken-row">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{r.user_name ?? "—"}</div>
                          {r.phone && <a href={`tel:+${r.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"><Phone className="h-3 w-3" />{formatTzPhone(r.phone)}</a>}
                          <div className="mt-1">{signupBadge(r)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          <div className="font-medium text-slate-900">{r.shop_name}</div>
                          <div className="text-xs text-slate-500">opened {formatDate(r.shop_created_at)} · {what(r)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          <div>{r.inviting_shop_name}</div>
                          <div className="text-xs text-slate-500">{formatDate(r.invited_at)}</div>
                        </td>
                        <td className="px-3 py-2.5">{status(r)}</td>
                        <td className="px-3 py-2.5 text-right">{action(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={!!moving}
        title={`Move ${moving?.user_name ?? "this person"} to ${moving?.inviting_shop_name ?? ""}?`}
        confirmLabel="Remove their shop and move them"
        destructive
        busy={busy}
        onConfirm={move}
        onCancel={() => setMoving(null)}
      >
        {moving && (
          <div className="space-y-2 text-sm text-slate-700" data-testid="move-confirm">
            <p>Their shop <strong>“{moving.shop_name}”</strong> is deleted for good, with {what(moving)}.</p>
            <p>They keep their account, number and password, and become <strong>staff at {moving.inviting_shop_name}</strong>.</p>
            <p className="text-slate-500">If the shop has been used since this list was loaded, nothing happens and you are told why.</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
