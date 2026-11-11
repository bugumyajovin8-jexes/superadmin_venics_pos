import { useState, useEffect } from "react"
import { supabase, fetchAllRecords } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { Badge } from "@/src/components/ui/Badge"
import { Modal } from "@/src/components/ui/Modal"
import { UserContact } from "@/src/components/ui/UserContact"
import { matchesUser } from "@/src/lib/utils"
import { usePageSearch } from "@/src/lib/search"
import { ShieldBan, CalendarPlus, Filter, Loader2, Receipt, HeartPulse } from "lucide-react"
import { toast } from "@/src/components/ui/Toaster"
import { ConfirmDialog } from "@/src/components/ConfirmDialog"
import { RenewLicenceModal, type RenewTarget } from "@/src/components/RenewLicenceModal"
import { PaymentsTable } from "@/src/components/PaymentsTable"
import { type LicencePayment, attachOwners, explainError, loadPayments } from "@/src/lib/licences"

/** A boss's login: phone, or email for old accounts that have not added one. */
interface Owner {
  id: string
  name: string
  email: string | null
  phone: string | null
  shop_id: string
}

interface Shop {
  id: string
  name: string
  owner_name: string | null
  phone: string | null
  status: string
  created_at: string
  created_by?: string | null
  licenses?: { id: string, expiry_date: string }[]
  owners?: Owner[]
}

export function ShopsView({ onOpenHealth }: { onOpenHealth?: (shopId: string) => void } = {}) {
  // The header's search bar.
  const searchTerm = usePageSearch()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  // Renewing goes through one form (RenewLicenceModal) that records the payment.
  const [renewing, setRenewing] = useState<{ target: RenewTarget; mode: "days" | "date" } | null>(null)
  const [blockTarget, setBlockTarget] = useState<Shop | null>(null)
  const [blocking, setBlocking] = useState(false)
  const [paymentsFor, setPaymentsFor] = useState<Shop | null>(null)
  const [shopPayments, setShopPayments] = useState<LicencePayment[] | null>(null)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    setLoading(true)
    try {
      const query = supabase
        .from('shops')
        .select('*, licenses(id, expiry_date)')
        .order('created_at', { ascending: false })

      // Owners renewing by phone quote their account number, so it must be
      // searchable here. Bosses only (admin is a boss on Desktop). The list
      // still loads if this part fails.
      const ownersQuery = supabase
        .from('users')
        .select('id, name, email, phone, shop_id')
        .in('role', ['boss', 'admin'])

      const [data, owners] = await Promise.all([
        fetchAllRecords(query),
        fetchAllRecords(ownersQuery).catch((err: unknown) => {
          console.error("Error fetching shop owners:", err)
          return [] as Owner[]
        }),
      ])
      // Owners: the bosses in each shop now, and whoever created it (an owner of
      // several shops is signed in to one at a time).
      const normalizedData = attachOwners((data || []) as any[], owners as Owner[]).map((shop: any) => {
        let normalizedLicenses = shop.licenses;
        if (shop.licenses && !Array.isArray(shop.licenses)) {
          normalizedLicenses = [shop.licenses];
        } else if (!shop.licenses) {
          normalizedLicenses = [];
        }
        return {
          ...shop,
          licenses: normalizedLicenses,
        };
      })
      setShops(normalizedData)
    } catch (error) {
      console.error("Error fetching shops:", error)
      toast.error(`Could not load the shops: ${explainError(error)}`)
    }
    setLoading(false)
  }

  const query = searchTerm.trim()
  const filteredShops = shops.filter(shop =>
    shop.name?.toLowerCase().includes(query.toLowerCase()) ||
    shop.id?.toLowerCase().includes(query.toLowerCase()) ||
    shop.owner_name?.toLowerCase().includes(query.toLowerCase()) ||
    (!!query && shop.owners?.some(o => matchesUser(o, query)))
  )

  const toRenewTarget = (shop: Shop): RenewTarget => ({
    id: shop.id,
    name: shop.name,
    created_by: shop.created_by ?? null,
    owners: shop.owners ?? [],
    expiry: shop.licenses?.[0]?.expiry_date ?? null,
  })

  /** Block or unblock, after "Are you sure?", and say plainly if it did not work. */
  const confirmToggleBlock = async () => {
    if (!blockTarget) return
    const newStatus = blockTarget.status === 'active' ? 'blocked' : 'active'
    setBlocking(true)
    try {
      // Asked back: a write the database refuses quietly changes no rows.
      const { data, error } = await supabase
        .from('shops')
        .update({ status: newStatus })
        .eq('id', blockTarget.id)
        .select('id, status')
      if (error) throw error
      if (!data?.length || data[0].status !== newStatus) throw new Error('the database did not save the change')
      setShops(prev => prev.map(shop => shop.id === blockTarget.id ? { ...shop, status: newStatus } : shop))
      toast.success(`${blockTarget.name} is now ${newStatus === 'blocked' ? 'blocked' : 'active'}.`)
      setBlockTarget(null)
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error(`Could not ${newStatus === 'blocked' ? 'block' : 'unblock'} ${blockTarget.name}: ${explainError(error)}`)
    } finally {
      setBlocking(false)
    }
  }

  const openPayments = async (shop: Shop) => {
    setPaymentsFor(shop)
    setShopPayments(null)
    setPaymentsError(null)
    try {
      setShopPayments(await loadPayments(shop.id))
    } catch (error) {
      setPaymentsError(explainError(error))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Shop Management</h2>
          <p className="text-slate-500">Manage merchant accounts, licenses, and access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchShops}>
            Refresh Data
          </Button>
          <Button className="hidden sm:inline-flex">Add New Shop</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle>Registered Merchants</CardTitle>
            <span className="text-sm text-slate-500" data-testid="shop-count">
              {searchTerm.trim() ? `${filteredShops.length} of ${shops.length} match “${searchTerm.trim()}”` : `${shops.length} shops`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {/* On a phone: a card per shop, its actions in two rows of buttons. */}
          <div className="space-y-3 md:hidden" data-testid="shop-cards">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading shops…</div>
            ) : filteredShops.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No shops found matching your search.</p>
            ) : filteredShops.map(shop => (
              <div key={shop.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{shop.name}</p>
                    <p className="text-xs text-slate-500">
                      {shop.owner_name || "N/A"}
                      {shop.owners?.[0] && <> · <UserContact phone={shop.owners[0].phone} email={shop.owners[0].email} /></>}
                    </p>
                  </div>
                  <Badge variant={shop.status === 'active' ? 'success' : 'destructive'}>{shop.status.toUpperCase()}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-slate-600">
                  Licence: {shop.licenses?.[0]?.expiry_date ? new Date(shop.licenses[0].expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "none"}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setRenewing({ target: toRenewTarget(shop), mode: "days" })}>+30d</Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" onClick={() => setRenewing({ target: toRenewTarget(shop), mode: "date" })}><CalendarPlus className="h-3 w-3" />Extend</Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" onClick={() => openPayments(shop)}><Receipt className="h-3 w-3" />Payments</Button>
                  {onOpenHealth && (
                    <Button variant="outline" size="sm" className="col-span-2 h-9 gap-1 text-xs" onClick={() => onOpenHealth(shop.id)}><HeartPulse className="h-3 w-3" />Health</Button>
                  )}
                  <Button variant={shop.status === 'active' ? 'outline' : 'default'} size="sm" className={`h-9 gap-1 text-xs ${shop.status === 'active' ? 'border-red-200 text-red-600' : ''} ${onOpenHealth ? '' : 'col-span-3'}`} onClick={() => setBlockTarget(shop)}>
                    <ShieldBan className="h-3 w-3" />{shop.status === 'active' ? 'Block' : 'Unblock'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden rounded-md border border-slate-200 md:block">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Shop ID / Name</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">License Expiry</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading shops from Supabase...
                      </div>
                    </td>
                  </tr>
                ) : filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No shops found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredShops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{shop.name}</div>
                        <div className="text-slate-500 text-xs font-mono">{shop.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{shop.owner_name || 'N/A'}</div>
                        {shop.owners?.map(o => (
                          <div key={o.id} className="max-w-[14rem] text-xs text-slate-500">
                            <UserContact phone={o.phone} email={o.email} />
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={shop.status === 'active' ? 'success' : 'destructive'}>
                          {shop.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {shop.licenses?.[0]?.expiry_date ? new Date(shop.licenses[0].expiry_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs px-2"
                            title="Renew for 30 days and record the payment"
                            onClick={() => setRenewing({ target: toRenewTarget(shop), mode: "days" })}
                          >
                            +30d
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            title="Renew to a date and record the payment"
                            onClick={() => setRenewing({ target: toRenewTarget(shop), mode: "date" })}
                          >
                            <CalendarPlus className="h-3 w-3" />
                            Extend
                          </Button>
                          {onOpenHealth && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs px-2"
                              title="Devices, sync and what is stuck"
                              onClick={() => onOpenHealth(shop.id)}
                            >
                              <HeartPulse className="h-3 w-3" />
                              Health
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs px-2"
                            title="This shop's payments"
                            onClick={() => openPayments(shop)}
                          >
                            <Receipt className="h-3 w-3" />
                            Payments
                          </Button>
                          <Button
                            variant={shop.status === 'active' ? 'destructive' : 'default'}
                            size="sm"
                            className="h-8 gap-1 text-xs w-24"
                            onClick={() => setBlockTarget(shop)}
                          >
                            <ShieldBan className="h-3 w-3" />
                            {shop.status === 'active' ? 'Block' : 'Unblock'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RenewLicenceModal
        target={renewing?.target ?? null}
        initialMode={renewing?.mode ?? "days"}
        onClose={() => setRenewing(null)}
        onDone={fetchShops}
      />

      <ConfirmDialog
        isOpen={!!blockTarget}
        title={blockTarget?.status === 'active' ? `Block ${blockTarget?.name}?` : `Unblock ${blockTarget?.name}?`}
        confirmLabel={blockTarget?.status === 'active' ? 'Block shop' : 'Unblock shop'}
        destructive={blockTarget?.status === 'active'}
        busy={blocking}
        onConfirm={confirmToggleBlock}
        onCancel={() => setBlockTarget(null)}
      >
        {blockTarget?.status === 'active'
          ? <>The shop's status becomes <strong>BLOCKED</strong> here. Note: the apps do not act on this status yet, so the shop keeps working until that is built.</>
          : <>The shop's status goes back to <strong>ACTIVE</strong>.</>}
      </ConfirmDialog>

      <Modal
        isOpen={!!paymentsFor}
        onClose={() => setPaymentsFor(null)}
        title={`Payments: ${paymentsFor?.name ?? ''}`}
        className="max-w-4xl"
      >
        {paymentsError
          ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{paymentsError}</p>
          : shopPayments === null
            ? <div className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading payments…</div>
            : <PaymentsTable payments={shopPayments} showShop={false} onChanged={() => paymentsFor && openPayments(paymentsFor)} />}
      </Modal>
    </div>
  )
}
