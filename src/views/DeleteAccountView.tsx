import { useState, useEffect } from "react"
import { usePageSearch } from "@/src/lib/search"
import { supabase, fetchAllRecords } from "@/src/lib/supabase"
import { Card, CardContent } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { Badge } from "@/src/components/ui/Badge"
import { Modal } from "@/src/components/ui/Modal"
import { UserContact } from "@/src/components/ui/UserContact"
import { matchesUser, formatTzPhone } from "@/src/lib/utils"
import { Loader2, UserX, Store, AlertTriangle, CheckCircle2, MailOpen, Trash2 } from "lucide-react"

/**
 * Staff often register on their own instead of waiting for their boss's
 * invitation, and end up with a shop of their own; their number is then
 * "already registered". This page deletes such an account completely —
 * sign-in, profile, the shops it created and everything in them — through
 * public.superadmin_delete_account (migration 20261025), which refuses
 * anything that looks like a real shop.
 */

interface Account {
  id: string
  /** Null for a sign-in whose profile was never created. */
  name: string | null
  email: string | null
  phone: string | null
  role: string | null
  created_at: string | null
  createdShops: { id: string, name: string }[]
  staffOf: { id: string, name: string } | null
}

type Blocker =
  | { code: 'not_found' | 'superadmin' | 'self' | 'auth_locked' }
  | { code: 'others_in_shop', name: string, role: string | null, shop_name: string }
  | { code: 'records_elsewhere', table: string, column: string, count: number }

interface Report {
  applied: boolean
  account: {
    id: string
    in_auth: boolean
    has_profile: boolean
    name: string | null
    role: string | null
    phone: string | null
    email: string | null
    created_at: string | null
    last_sign_in_at: string | null
    last_seen: string | null
  }
  shops: { id: string, name: string, status: string | null, created_at: string, licence_expiry: string | null, licence_extended: boolean }[]
  member_of: { shop_id: string, shop_name: string } | null
  invitations: { shop_id: string, shop_name: string, created_at: string }[]
  rows: { table: string, column: string, via: 'shop' | 'account', count: number }[]
  blockers: Blocker[]
}

/** What the rows are, in words. Tables not listed show their own name. */
const TABLE_WORDS: Record<string, [string, string]> = {
  products: ['product', 'products'],
  sales: ['sale', 'sales'],
  sale_items: ['sale item', 'sale items'],
  expenses: ['expense', 'expenses'],
  debt_payments: ['debt payment', 'debt payments'],
  audit_logs: ['activity log entry', 'activity log entries'],
  licenses: ['licence', 'licences'],
  shop_invitations: ['invitation sent', 'invitations sent'],
  features: ['feature setting', 'feature settings'],
  assistant_chats: ['V Smart message', 'V Smart messages'],
  saas_telemetry: ['usage record', 'usage records'],
  sms_events: ['SMS record', 'SMS records'],
  work_sessions: ['work session', 'work sessions'],
  product_stock_deltas: ['stock change', 'stock changes'],
  ai_usage: ['AI usage day', 'AI usage days'],
  shop_sync_state: ['sync marker', 'sync markers'],
}

function rowWords(table: string, count: number): string {
  const words = TABLE_WORDS[table] ?? [table.replace(/_/g, ' '), table.replace(/_/g, ' ')]
  return `${count.toLocaleString()} ${count === 1 ? words[0] : words[1]}`
}

function day(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function ago(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 60) return `${days} days ago`
  return day(iso)
}

function blockerText(b: Blocker): string {
  switch (b.code) {
    case 'not_found': return 'This account no longer exists. It may have been deleted already.'
    case 'superadmin': return 'This is a superadmin account.'
    case 'self': return 'This is your own account.'
    case 'auth_locked': return 'Supabase does not let the database delete sign-ins, so nothing can be deleted here.'
    case 'others_in_shop':
      return `${b.name}${b.role ? ` (${b.role})` : ''} is also in ${b.shop_name}. A shop with other people in it is a real shop, so it is not deleted here.`
    case 'records_elsewhere':
      return `${rowWords(b.table, b.count)} ${b.count === 1 ? 'belongs' : 'belong'} to another shop (made while working there). That is the other shop's history, so the account is not deleted.`
  }
}

/** The error from the database, in words. */
function errorText(error: { message?: string, code?: string } | null): string {
  if (!error) return 'Something went wrong.'
  if (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '')) {
    return 'The database is missing this feature. Run the migration 20261025_superadmin_delete_account.sql in Supabase first.'
  }
  // 20261111_delete_account_reauth.sql: a deletion needs the password from the last 15 minutes.
  if (/confirm your password again/i.test(error.message ?? '')) {
    return 'Nothing was deleted: for safety, deleting needs your password from the last 15 minutes. Press “Lock now” at the top and unlock again with your password.'
  }
  if (error.code === '42501') return 'Only a superadmin can do this. Sign in again.'
  if (/nothing deleted/i.test(error.message ?? '')) return `Nothing was deleted: ${error.message}`
  return `Nothing was deleted. ${error.message ?? ''}`.trim()
}

export function DeleteAccountView() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The header's search bar.
  const searchTerm = usePageSearch()

  const [selected, setSelected] = useState<Account | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [paidOk, setPaidOk] = useState(false)
  const [done, setDone] = useState<Report | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [users, shops] = await Promise.all([
        fetchAllRecords(supabase
          .from('users')
          .select('id, name, email, phone, role, shop_id, created_at')
          .order('created_at', { ascending: false })),
        fetchAllRecords(supabase
          .from('shops')
          .select('id, name, created_by, created_at')
          .order('created_at', { ascending: true })),
      ])
      const shopById = new Map<string, any>(shops.map((s: any) => [s.id, s]))
      const list: Account[] = users
        .filter((u: any) => u.role !== 'superadmin')
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          created_at: u.created_at,
          createdShops: shops.filter((s: any) => s.created_by === u.id).map((s: any) => ({ id: s.id, name: s.name })),
          staffOf: u.shop_id && shopById.get(u.shop_id)?.created_by !== u.id
            ? { id: u.shop_id, name: shopById.get(u.shop_id)?.name ?? u.shop_id }
            : null,
        }))
      // A shop whose creator has no profile: still an account that holds a number.
      const known = new Set(users.map((u: any) => u.id))
      for (const s of shops as any[]) {
        if (!s.created_by || known.has(s.created_by)) continue
        known.add(s.created_by)
        list.push({
          id: s.created_by, name: null, email: null, phone: null, role: null, created_at: s.created_at,
          createdShops: shops.filter((x: any) => x.created_by === s.created_by).map((x: any) => ({ id: x.id, name: x.name })),
          staffOf: null,
        })
      }
      setAccounts(list)
    } catch (error: any) {
      console.error("Error fetching accounts:", error)
      setLoadError(error?.message ?? 'Could not load accounts.')
    }
    setLoading(false)
  }

  const query = searchTerm.trim()
  const q = query.toLowerCase()
  const matches = query
    ? accounts.filter(a =>
        matchesUser(a, query) ||
        a.id.toLowerCase().startsWith(q) ||
        a.createdShops.some(s => s.name?.toLowerCase().includes(q)) ||
        !!a.staffOf?.name?.toLowerCase().includes(q))
    : accounts
  const shown = matches.slice(0, query ? 50 : 20)

  const openAccount = async (account: Account) => {
    setSelected(account)
    setReport(null)
    setModalError(null)
    setPaidOk(false)
    setChecking(true)
    const { data, error } = await supabase.rpc('superadmin_delete_account', { p_user: account.id, p_apply: false })
    if (error) {
      console.error("Error checking account:", error)
      setModalError(errorText(error))
    } else {
      setReport(data as Report)
    }
    setChecking(false)
  }

  const closeModal = () => {
    if (deleting) return
    setSelected(null)
    setReport(null)
    setModalError(null)
  }

  const deleteAccount = async () => {
    if (!selected) return
    setDeleting(true)
    setModalError(null)
    const { data, error } = await supabase.rpc('superadmin_delete_account', { p_user: selected.id, p_apply: true })
    setDeleting(false)
    if (error) {
      console.error("Error deleting account:", error)
      setModalError(errorText(error))
      // Show what stops it now, if something changed since the check.
      const again = await supabase.rpc('superadmin_delete_account', { p_user: selected.id, p_apply: false })
      if (!again.error) setReport(again.data as Report)
      return
    }
    setDone(data as Report)
    setAccounts(prev => prev.filter(a => a.id !== selected.id))
    setSelected(null)
    setReport(null)
  }

  const blocked = !report || report.blockers.length > 0
  const paid = !!report?.shops.some(s => s.licence_extended)
  const dataRows: Report['rows'] = (report?.rows ?? []).filter(r => r.table !== 'users' && r.table !== 'shops')
  const byTable = Object.entries(dataRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.table] = (acc[r.table] ?? 0) + r.count
    return acc
  }, {})).sort((a, b) => b[1] - a[1])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading accounts...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Delete Account</h2>
        <p className="text-slate-500 max-w-3xl">
          For staff who registered and made their own shop by mistake. Deletes the account, the shops it
          created and everything in them, so the phone number or email can register again.
        </p>
      </div>

      {done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" data-testid="delete-done">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                Deleted {done.account.name ?? 'the account'}.{' '}
                {done.account.phone
                  ? <>{formatTzPhone(done.account.phone)} can register again.</>
                  : done.account.email ? <>{done.account.email} can register again.</> : null}
              </div>
              {done.invitations.length > 0 && (
                <div>
                  {done.invitations[0].shop_name} has invited this number: when they register again with it, they
                  join that shop as staff straight away.
                </div>
              )}
              <div className="text-emerald-800">
                If the app on their phone is still signed in to the old account, it signs out by itself once it is
                online (it can take up to an hour). To register sooner, they can sign out themselves.
              </div>
            </div>
            <button onClick={() => setDone(null)} className="ml-auto text-emerald-700 hover:underline shrink-0">Close</button>
          </div>
        </div>
      )}


      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load accounts: {loadError}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-3 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {query ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'Newest accounts'}
          </div>
          {shown.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              {query ? <>No account matches “{query}”.</> : 'No accounts.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map(account => (
                <li key={account.id} className="flex items-center gap-4 px-6 py-3" data-testid="account-row">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-medium">
                    {(account.name ?? '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-slate-900 truncate">{account.name ?? 'No profile'}</span>
                      {account.role && <Badge variant="secondary" className="text-[10px] py-0 px-2 shrink-0">{account.role}</Badge>}
                    </div>
                    <UserContact phone={account.phone} email={account.email} className="text-xs text-slate-500" />
                  </div>
                  <div className="hidden md:block w-64 min-w-0 text-xs text-slate-600">
                    {account.createdShops.map(s => (
                      <div key={s.id} className="flex items-center gap-1 min-w-0">
                        <Store className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{s.name}</span>
                      </div>
                    ))}
                    {account.staffOf && <div className="truncate text-slate-500">Staff of {account.staffOf.name}</div>}
                    {!account.createdShops.length && !account.staffOf && <span className="text-slate-400">No shop</span>}
                  </div>
                  <div className="hidden sm:block w-24 shrink-0 text-xs text-slate-500 text-right">{ago(account.created_at)}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => openAccount(account)}
                  >
                    <UserX className="h-4 w-4" />
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {matches.length > shown.length && (
            <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
              Showing {shown.length} of {matches.length}. Search to narrow it down.
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={!!selected} onClose={closeModal} title="Delete account" className="max-w-lg">
        {checking ? (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking what this account holds...
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {report && (
              <>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{report.account.name ?? 'No profile'}</span>
                    {report.account.role && <Badge variant="secondary" className="text-[10px] py-0 px-2">{report.account.role}</Badge>}
                  </div>
                  <UserContact phone={report.account.phone} email={report.account.email} className="text-slate-600" />
                  <div className="text-xs text-slate-500 mt-1">
                    Registered {day(report.account.created_at)}
                    {report.account.last_seen && <> · last seen {day(report.account.last_seen)}</>}
                  </div>
                </div>

                {report.shops.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {blocked
                        ? (report.shops.length === 1 ? 'Shop it created' : `${report.shops.length} shops it created`)
                        : (report.shops.length === 1 ? 'Shop that will be deleted' : `${report.shops.length} shops that will be deleted`)}
                    </div>
                    {report.shops.map(s => (
                      <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-indigo-600" />
                          <span className="font-medium text-slate-900">{s.name}</span>
                          <span className="text-xs text-slate-500">made {day(s.created_at)}</span>
                        </div>
                        {s.licence_extended ? (
                          <div className="mt-1 flex items-start gap-1.5 text-xs text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                            Licence runs to {day(s.licence_expiry)}, past the 14-day free trial. It may have been paid for.
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-slate-500">
                            {s.licence_expiry ? `Free trial, ends ${day(s.licence_expiry)}` : 'No licence'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {report.member_of && (
                  <div className="text-slate-600">
                    Staff of <span className="font-medium">{report.member_of.shop_name}</span>: they are removed from it.
                    That shop is not touched.
                  </div>
                )}

                {byTable.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{blocked ? 'What it holds' : 'Also deleted'}</div>
                    <div className="flex flex-wrap gap-1.5" data-testid="delete-rows">
                      {byTable.map(([table, n]) => (
                        <span key={table} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{rowWords(table, n)}</span>
                      ))}
                    </div>
                  </div>
                )}

                {report.invitations.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-indigo-900">
                    <MailOpen className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
                    <div>
                      <span className="font-medium">{report.invitations.map(i => i.shop_name).join(', ')}</span>{' '}
                      invited this number. The invitation is kept: when they register again with it, they join that shop
                      as staff.
                    </div>
                  </div>
                )}

                {report.blockers.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 space-y-1.5" data-testid="delete-blockers">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      This account cannot be deleted here
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {report.blockers.map((b, i) => <li key={i}>{blockerText(b)}</li>)}
                    </ul>
                  </div>
                )}

                {!blocked && paid && (
                  <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={paidOk} onChange={e => setPaidOk(e.target.checked)} />
                    I checked: this shop's licence runs past the free trial, and it should still be deleted.
                  </label>
                )}

                {!blocked && (
                  <p className="text-xs text-slate-500">This cannot be undone. If anything fails, nothing is deleted.</p>
                )}
              </>
            )}

            {modalError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700" data-testid="delete-error">{modalError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeModal} disabled={deleting}>
                {blocked ? 'Close' : 'Cancel'}
              </Button>
              {!blocked && (
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={deleteAccount}
                  disabled={deleting || (paid && !paidOk)}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? 'Deleting...' : 'Delete everything'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
