import { supabase, fetchAllRecords } from "@/src/lib/supabase"
import { matchesUser } from "@/src/lib/utils"

/**
 * Licences and the payments that renew them.
 *
 * Every renewal goes through superadmin_renew_licence() (Mobile app:
 * supabase/migrations/20261111_licence_payments.sql), which extends the
 * licence and records the payment in one transaction. The owner's SMS goes
 * through the licence-sms edge function, which holds the Beem keys.
 */

export type PaymentMethod = "mpesa" | "tigopesa" | "airtel" | "halopesa" | "bank" | "cash" | "free"

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; needsCode: boolean }[] = [
  { value: "mpesa", label: "M-Pesa", needsCode: true },
  { value: "tigopesa", label: "Mixx by Yas (Tigo Pesa)", needsCode: true },
  { value: "airtel", label: "Airtel Money", needsCode: true },
  { value: "halopesa", label: "HaloPesa", needsCode: true },
  { value: "bank", label: "Bank", needsCode: false },
  { value: "cash", label: "Cash", needsCode: false },
  { value: "free", label: "Free (no payment)", needsCode: false },
]

export function methodLabel(method: string): string {
  return PAYMENT_METHODS.find(m => m.value === method)?.label ?? method
}

export interface LicencePayment {
  id: string
  shop_id: string
  licence_id: string | null
  amount: number
  method: PaymentMethod
  reference: string | null
  days_added: number
  previous_expiry: string | null
  new_expiry: string
  note: string | null
  recorded_by: string | null
  sms_status: SmsState | null
  sms_at: string | null
  created_at: string
}

export interface Owner {
  id: string
  name: string
  email: string | null
  phone: string | null
  shop_id: string
}

export interface LicenceShop {
  id: string
  name: string
  owner_name: string | null
  status: string
  created_by: string | null
  licence: { id: string; expiry_date: string; status: string; is_trial: boolean } | null
  owners: Owner[]
}

const DAY = 86_400_000

/** "TSh 15,000" */
export function formatTZS(amount: number): string {
  return `TSh ${Math.round(amount).toLocaleString("en-US")}`
}

/** "11 Dec 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** Whole days from now to `iso`: 3 = in 3 days, -5 = 5 days ago, 0 = today. */
export function daysFromNow(iso: string, now = Date.now()): number {
  const end = new Date(iso)
  const today = new Date(now)
  const a = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((a - b) / DAY)
}

export function describeDays(days: number): string {
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/** The new expiry a renewal by days gives: from the current expiry, or from now if it has passed. */
export function expiryAfter(current: string | null | undefined, days: number, now = Date.now()): Date {
  const from = Math.max(current ? new Date(current).getTime() : now, now)
  return new Date(from + days * DAY)
}

/** A shop matches its name, the start of its ID, or any owner's name, email or phone. */
export function shopMatches(s: Pick<LicenceShop, "id" | "name" | "owners">, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return !!s.name?.toLowerCase().includes(q) || s.id.toLowerCase().startsWith(q) || s.owners.some(o => matchesUser(o, q))
}

/** The person to call about a shop: its owner (who created it) first, then its bosses. */
export function contactFor(shop: Pick<LicenceShop, "created_by" | "owners">): Owner | null {
  return shop.owners.find(o => o.id === shop.created_by && (o.phone || o.email))
    ?? shop.owners.find(o => o.phone)
    ?? shop.owners[0]
    ?? null
}

export interface RenewalsDue {
  /** Expiring today or in the next 7 days, soonest first. */
  expiringSoon: LicenceShop[]
  /** Expired in the last 30 days, most recent first. */
  recentlyExpired: LicenceShop[]
}

export function renewalsDue(shops: LicenceShop[], now = Date.now()): RenewalsDue {
  const withDays = shops
    .filter(s => s.licence?.expiry_date)
    .map(s => ({ s, days: daysFromNow(s.licence!.expiry_date, now) }))
  return {
    expiringSoon: withDays.filter(x => x.days >= 0 && x.days <= 7).sort((a, b) => a.days - b.days).map(x => x.s),
    recentlyExpired: withDays.filter(x => x.days < 0 && x.days >= -30).sort((a, b) => b.days - a.days).map(x => x.s),
  }
}

export interface IncomeSummary {
  thisMonth: number
  lastMonth: number
  paymentsThisMonth: number
  freeThisMonth: number
  freeDaysThisMonth: number
}

/** Money received in this calendar month and the last (local time), and what was given free. */
export function incomeSummary(payments: LicencePayment[], now = new Date()): IncomeSummary {
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const out: IncomeSummary = { thisMonth: 0, lastMonth: 0, paymentsThisMonth: 0, freeThisMonth: 0, freeDaysThisMonth: 0 }
  for (const p of payments) {
    const at = new Date(p.created_at).getTime()
    const amount = Number(p.amount) || 0
    if (at >= startThis) {
      if (p.method === "free") {
        out.freeThisMonth += 1
        out.freeDaysThisMonth += Math.max(0, p.days_added)
      } else {
        out.thisMonth += amount
        out.paymentsThisMonth += 1
      }
    } else if (at >= startLast && p.method !== "free") {
      out.lastMonth += amount
    }
  }
  return out
}

// ---------------------------------------------------------------- loading

export async function loadLicenceShops(): Promise<LicenceShop[]> {
  const [shops, owners] = await Promise.all([
    fetchAllRecords(
      supabase
        .from("shops")
        .select("id, name, owner_name, status, created_by, licenses(id, expiry_date, status, is_trial)")
        .order("created_at", { ascending: false }),
    ),
    // Every boss, whichever shop (if any) they are signed in to now.
    fetchAllRecords(
      supabase
        .from("users")
        .select("id, name, email, phone, shop_id")
        .in("role", ["boss", "admin"]),
    ),
  ])
  return attachOwners(shops as any[], owners as Owner[]).map(s => {
    const lic = Array.isArray(s.licenses) ? s.licenses[0] : s.licenses
    return {
      id: s.id,
      name: s.name,
      owner_name: s.owner_name,
      status: s.status,
      created_by: s.created_by,
      licence: lic ? { id: lic.id, expiry_date: lic.expiry_date, status: lic.status, is_trial: lic.is_trial !== false } : null,
      owners: s.owners,
    }
  })
}

/**
 * Each shop's owners: the bosses signed in to it now, AND the person who
 * created it. An owner of several shops is signed in to one at a time, so
 * without the second rule their other shops showed no owner and no phone.
 * The creator comes first.
 */
export function attachOwners<S extends { id: string; created_by?: string | null }>(shops: S[], bosses: Owner[]): (S & { owners: Owner[] })[] {
  const byId = new Map(bosses.map(b => [b.id, b]))
  const byShop = new Map<string, Owner[]>()
  for (const b of bosses) if (b.shop_id) byShop.set(b.shop_id, [...(byShop.get(b.shop_id) ?? []), b])
  return shops.map(s => {
    const inShop = byShop.get(s.id) ?? []
    const creator = s.created_by ? byId.get(s.created_by) : undefined
    const owners = creator && !inShop.some(o => o.id === creator.id) ? [creator, ...inShop] : inShop
    return { ...s, owners: [...owners].sort((a, b) => Number(b.id === s.created_by) - Number(a.id === s.created_by)) }
  })
}

export async function loadPayments(shopId?: string): Promise<LicencePayment[]> {
  let query = supabase.from("licence_payments").select("*").order("created_at", { ascending: false })
  if (shopId) query = query.eq("shop_id", shopId)
  return (await fetchAllRecords(query)) as LicencePayment[]
}

// ---------------------------------------------------------------- renewing

export interface RenewRequest {
  shopId: string
  days?: number
  newExpiry?: string
  amount: number
  method: PaymentMethod
  reference?: string
  note?: string
}

/** Readable reasons for what the server refuses. */
export function explainError(err: any): string {
  const message = String(err?.message ?? err ?? "")
  // A table or function the server does not have yet: name the SQL file that adds it.
  const missing = ["PGRST202", "PGRST205", "42P01", "42883"].includes(err?.code)
    || /could not find the (function|table)|does not exist/i.test(message)
  if (missing && /superadmin_settings|superadmin_overview/i.test(message)) {
    return "The dashboard SQL (20261111_superadmin_dashboard.sql) has not been run on Supabase yet."
  }
  if (missing && (/licence_payments|superadmin_renew_licence/i.test(message) || err?.code === "PGRST202")) {
    return "The licence payments SQL (20261111_licence_payments.sql) has not been run on Supabase yet."
  }
  if (/superadmin only/i.test(message)) return "Only a superadmin can do this. Sign in again."
  if (/failed to fetch|network/i.test(message)) return "No connection to Supabase. Check the internet and try again."
  return message ? message.charAt(0).toUpperCase() + message.slice(1) + "." : "Something went wrong."
}

export async function renewLicence(req: RenewRequest): Promise<{ payment: LicencePayment; licence: { status: string; expiry_date: string } }> {
  const { data, error } = await supabase.rpc("superadmin_renew_licence", {
    p_shop_id: req.shopId,
    p_days: req.days ?? null,
    p_new_expiry: req.newExpiry ?? null,
    p_amount: req.amount,
    p_method: req.method,
    p_reference: req.reference?.trim() || null,
    p_note: req.note?.trim() || null,
  })
  if (error) throw new Error(explainError(error))
  return data as any
}

// ---------------------------------------------------------------- the owner's SMS

export type SmsState = "sent" | "failed" | "no_phone" | "not_configured" | "already_sent"

export interface SmsOutcome {
  ok: boolean
  message: string
}

/** What the owner will read. Kept the same as supabase/functions/licence-sms/handler.ts. */
export function renewalSmsText(shopName: string | null | undefined, newExpiry: Date | string): string {
  const shop = String(shopName ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim()
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(newExpiry))
  return `Venics Sales: ${shop ? `Leseni yako ya ${shop}` : "Leseni yako"} imeongezwa hadi ${date}. Asante!`
}

export async function sendRenewalSms(paymentId: string, resend = false): Promise<SmsOutcome> {
  const { data, error } = await supabase.functions.invoke("licence-sms", { body: { payment_id: paymentId, resend } })
  if (error) {
    const status = (error as any)?.context?.status
    if (status === 404 || /failed to send a request|not found/i.test(error.message)) {
      return { ok: false, message: "No SMS: the licence-sms function is not deployed on Supabase yet." }
    }
    let detail = ""
    try { detail = (await (error as any).context?.json?.())?.error ?? "" } catch { /* not JSON */ }
    return { ok: false, message: `No SMS: ${detail || error.message}` }
  }
  switch ((data as any)?.sms as SmsState) {
    case "sent": return { ok: true, message: `SMS sent to the owner (${(data as any).to}).` }
    case "already_sent": return { ok: true, message: "The SMS had already been sent." }
    case "no_phone": return { ok: false, message: "No SMS: the owner has no phone number on file." }
    case "not_configured": return { ok: false, message: "No SMS: Beem is not set up on Supabase." }
    default: return { ok: false, message: "The SMS failed to send. You can resend it from Licences & Payments." }
  }
}

export function smsBadge(state: SmsState | null): { label: string; variant: "success" | "warning" | "destructive" | "secondary" } {
  switch (state) {
    case "sent": return { label: "SMS sent", variant: "success" }
    case "failed": return { label: "SMS failed", variant: "destructive" }
    case "no_phone": return { label: "No phone", variant: "warning" }
    case "not_configured": return { label: "SMS off", variant: "warning" }
    default: return { label: "No SMS", variant: "secondary" }
  }
}
