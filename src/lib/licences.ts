import { supabase, fetchAllRecords } from "@/src/lib/supabase"
import { matchesUser } from "@/src/lib/utils"

/**
 * Licences and the payments that renew them.
 *
 * Every renewal goes through superadmin_renew_licence() (Mobile app:
 * supabase/migrations/20261111_licence_payments.sql), which extends the
 * licence and records the payment in one transaction. The owner's SMS goes
 * through the licence-sms edge function, which holds the Beem keys.
 *
 * "Not paid yet" (method credit, 20261117_licence_credit.sql): the licence is
 * extended now and the amount agreed is recorded as OWED, with no transaction
 * code. When the money comes, superadmin_settle_licence_payment() marks that
 * same row paid, with how it was paid and the code. Income counts it then.
 */

export type PaymentMethod = "mpesa" | "tigopesa" | "airtel" | "halopesa" | "bank" | "cash" | "free" | "credit"

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; needsCode: boolean }[] = [
  { value: "mpesa", label: "M-Pesa", needsCode: true },
  { value: "tigopesa", label: "Mixx by Yas (Tigo Pesa)", needsCode: true },
  { value: "airtel", label: "Airtel Money", needsCode: true },
  { value: "halopesa", label: "HaloPesa", needsCode: true },
  { value: "bank", label: "Bank", needsCode: false },
  { value: "cash", label: "Cash", needsCode: false },
  { value: "free", label: "Free (no payment)", needsCode: false },
  { value: "credit", label: "Not paid yet (pays later)", needsCode: false },
]

/** How an owed renewal can be paid in the end: real money only. */
export const SETTLE_METHODS = PAYMENT_METHODS.filter(m => m.value !== "free" && m.value !== "credit")

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
  /** "owed": renewed before payment. Missing before 20261117_licence_credit.sql: paid. */
  status?: "paid" | "owed"
  /** When an owed renewal was paid. */
  settled_at?: string | null
  /**
   * The month it counts as income in ("YYYY-MM-01"), when chosen: paid at the
   * end of November for December, or moved later. Empty: the month the money
   * came in. 20261125_licence_income_month.sql.
   */
  income_month?: string | null
  income_month_set_at?: string | null
}

export const isOwed = (p: Pick<LicencePayment, "status">) => p.status === "owed"

/** Money that came in (not free, not still owed), and when it came. */
export const isMoney = (p: Pick<LicencePayment, "status" | "method">) => p.method !== "free" && !isOwed(p)
export const paidAt = (p: Pick<LicencePayment, "settled_at" | "created_at">) => p.settled_at || p.created_at

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

// ---------------------------------------------------------------- income
//
// A payment for several months is income for each of those months, not all for
// the month it came in. It is split into equal monthly shares from the month
// the money came in (a renewal paid later: the month it was paid): 6 months
// for TSh 100,000 is about TSh 16,667 a month for 6 months. A payment for a
// month or less counts in full in the month it came in. Free extensions and
// renewals not yet paid are not income.
//
// The month can be chosen (income_month): paid at the end of November for
// December counts in December, and a payment can be moved to another month.
// Its shares then start from that month. "Received" figures never move: they
// are the money that really came in that month.

const MONTH_DAYS = 30.44

/** How many months a payment bought: 1 for a month or less, else its days in whole months. */
export function monthsBought(p: Pick<LicencePayment, "days_added">): number {
  const days = Number(p.days_added) || 0
  return days <= 31 ? 1 : Math.max(1, Math.round(days / MONTH_DAYS))
}

/** "2026-11" (local time). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** The month `n` months after "YYYY-MM". */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number)
  return monthKey(new Date(y, m - 1 + n, 1))
}

/** The month the money came in ("YYYY-MM"; one still owed: when the renewal was made). */
export function receivedMonth(p: Pick<LicencePayment, "settled_at" | "created_at">): string {
  return monthKey(new Date(paidAt(p)))
}

/** The month a payment starts counting as income: the one chosen, else the month it came in. */
export function incomeStart(p: Pick<LicencePayment, "income_month" | "settled_at" | "created_at">): string {
  return p.income_month ? p.income_month.slice(0, 7) : receivedMonth(p)
}

/** Counted in a month other than the one the money came in. */
export function isMovedIncome(p: Pick<LicencePayment, "income_month" | "settled_at" | "created_at">): boolean {
  return !!p.income_month && p.income_month.slice(0, 7) !== receivedMonth(p)
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** "2026-12" → "December 2026" (long), "Dec 2026" (short) or "Dec" (tiny). */
export function monthLabel(key: string, style: "long" | "short" | "tiny" = "long"): string {
  const [y, m] = key.split("-").map(Number)
  const name = MONTH_NAMES[(m || 1) - 1] ?? key
  if (style === "tiny") return name.slice(0, 3)
  return `${style === "short" ? name.slice(0, 3) : name} ${y}`
}

/** "Dec 2026" or "Dec 2026 – Feb 2027": the months a payment counts in. */
export function incomeSpan(p: LicencePayment): string {
  const shares = incomeShares(p)
  if (!shares.length) return ""
  const a = monthLabel(shares[0].month, "short")
  return shares.length === 1 ? a : `${a} – ${monthLabel(shares[shares.length - 1].month, "short")}`
}

/** A payment's income month by month. The shares add up to the amount exactly. */
export function incomeShares(p: LicencePayment): { month: string; amount: number }[] {
  if (!isMoney(p)) return []
  const amount = Number(p.amount) || 0
  const n = monthsBought(p)
  const first = incomeStart(p)
  const share = Math.round(amount / n)
  return Array.from({ length: n }, (_, i) => ({
    month: addMonths(first, i),
    amount: i === n - 1 ? amount - share * (n - 1) : share,
  }))
}

/** Income per month ("YYYY-MM" → amount), all payments together. */
export function incomeByMonth(payments: LicencePayment[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of payments) for (const s of incomeShares(p)) out.set(s.month, (out.get(s.month) ?? 0) + s.amount)
  return out
}

/**
 * For the chart: the last `back` months up to this one, then the coming months
 * already paid for (up to `ahead`, stopping at the last one with money).
 */
export function incomeMonths(payments: LicencePayment[], now = new Date(), back = 6, ahead = 6): { month: string; amount: number; ahead: boolean }[] {
  const byMonth = incomeByMonth(payments)
  const current = monthKey(now)
  const out: { month: string; amount: number; ahead: boolean }[] = []
  for (let i = -(back - 1); i <= 0; i++) {
    const m = addMonths(current, i)
    out.push({ month: m, amount: byMonth.get(m) ?? 0, ahead: false })
  }
  let last = 0
  for (let i = 1; i <= ahead; i++) if ((byMonth.get(addMonths(current, i)) ?? 0) > 0) last = i
  for (let i = 1; i <= last; i++) {
    const m = addMonths(current, i)
    out.push({ month: m, amount: byMonth.get(m) ?? 0, ahead: true })
  }
  return out
}

export interface IncomeSummary {
  /** Income for this month: payments for a month or less received now, plus this month's share of longer ones. */
  thisMonth: number
  lastMonth: number
  /** The money that actually came in this month, whole amounts. */
  receivedThisMonth: number
  paymentsThisMonth: number
  /** Money already received for the months after this one. */
  paidAhead: number
  freeThisMonth: number
  freeDaysThisMonth: number
  /** Renewed before payment and not paid yet. */
  owedTotal: number
  owedCount: number
  /** The first payment recorded. */
  firstPaymentAt: string | null
}

/**
 * This month's and last month's income (local time, split as above), the
 * money that came in this month, what is paid ahead, what was given free, and
 * what is still owed. A renewal paid later counts from when the money came,
 * never while it is owed.
 */
export function incomeSummary(payments: LicencePayment[], now = new Date()): IncomeSummary {
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const thisKey = monthKey(now)
  const lastKey = addMonths(thisKey, -1)
  const out: IncomeSummary = {
    thisMonth: 0, lastMonth: 0, receivedThisMonth: 0, paymentsThisMonth: 0, paidAhead: 0,
    freeThisMonth: 0, freeDaysThisMonth: 0, owedTotal: 0, owedCount: 0, firstPaymentAt: null,
  }
  for (const p of payments) {
    if (!out.firstPaymentAt || p.created_at < out.firstPaymentAt) out.firstPaymentAt = p.created_at
    const amount = Number(p.amount) || 0
    if (isOwed(p)) {
      out.owedTotal += amount
      out.owedCount += 1
    } else if (p.method === "free") {
      if (new Date(p.created_at).getTime() >= startThis) {
        out.freeThisMonth += 1
        out.freeDaysThisMonth += Math.max(0, p.days_added)
      }
    } else {
      if (new Date(paidAt(p)).getTime() >= startThis) {
        out.receivedThisMonth += amount
        out.paymentsThisMonth += 1
      }
      for (const share of incomeShares(p)) {
        if (share.month === thisKey) out.thisMonth += share.amount
        else if (share.month === lastKey) out.lastMonth += share.amount
        else if (share.month > thisKey) out.paidAhead += share.amount
      }
    }
  }
  return out
}

/** "Received TSh 120,000 (2 payments) · TSh 83,333 paid ahead · last month TSh 20,000 · TSh 10,000 owed" */
export function incomeLine(i: IncomeSummary): string {
  const parts = [`Received ${formatTZS(i.receivedThisMonth)} (${i.paymentsThisMonth} payment${i.paymentsThisMonth === 1 ? "" : "s"})`]
  if (i.paidAhead > 0) parts.push(`${formatTZS(i.paidAhead)} paid ahead`)
  parts.push(`last month ${formatTZS(i.lastMonth)}`)
  if (i.owedCount) parts.push(`${formatTZS(i.owedTotal)} owed`)
  return parts.join(" · ")
}

/** Each shop's latest money payment, and what it still owes. */
export function paymentsByShop(payments: LicencePayment[]): { lastPaid: Map<string, LicencePayment>; owed: Map<string, { amount: number; count: number; since: string }> } {
  const lastPaid = new Map<string, LicencePayment>()
  const owed = new Map<string, { amount: number; count: number; since: string }>()
  for (const p of payments) {
    if (isOwed(p)) {
      const o = owed.get(p.shop_id) ?? { amount: 0, count: 0, since: p.created_at }
      o.amount += Number(p.amount) || 0
      o.count += 1
      if (p.created_at < o.since) o.since = p.created_at
      owed.set(p.shop_id, o)
    } else if (isMoney(p)) {
      const cur = lastPaid.get(p.shop_id)
      if (!cur || paidAt(p) > paidAt(cur)) lastPaid.set(p.shop_id, p)
    }
  }
  return { lastPaid, owed }
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
  // Pay later: the renewal refuses "credit", or the payment function is missing.
  if ((missing && /superadmin_settle_licence_payment/i.test(message)) || /unknown payment method/i.test(message)) {
    return "“Not paid yet” needs the SQL 20261117_licence_credit.sql run on Supabase first."
  }
  if (missing && /superadmin_set_income_month|income_month/i.test(message)) {
    return "Choosing the income month needs the SQL 20261125_licence_income_month.sql run on Supabase first."
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

export interface SettleRequest {
  paymentId: string
  method: PaymentMethod
  reference?: string
  /** What was actually paid, when it differs from the amount agreed. */
  amount?: number
  note?: string
}

/** An owed renewal is paid: the same row becomes paid, with how and the code. */
export async function settlePayment(req: SettleRequest): Promise<LicencePayment> {
  const { data, error } = await supabase.rpc("superadmin_settle_licence_payment", {
    p_payment_id: req.paymentId,
    p_method: req.method,
    p_reference: req.reference?.trim() || null,
    p_amount: req.amount ?? null,
    p_note: req.note?.trim() || null,
  })
  if (error) throw new Error(explainError(error))
  return data as LicencePayment
}

/**
 * The month a payment counts as income in: "YYYY-MM", or null for the month
 * the money came in. Not for free extensions.
 */
export async function setIncomeMonth(paymentId: string, month: string | null): Promise<LicencePayment> {
  const { data, error } = await supabase.rpc("superadmin_set_income_month", {
    p_payment_id: paymentId,
    p_month: month ? `${month}-01` : null,
  })
  if (error) throw new Error(explainError(error))
  return data as LicencePayment
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
