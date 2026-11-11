import { supabase } from "@/src/lib/supabase"
import { explainError, formatDate } from "@/src/lib/licences"

/**
 * A shop's health for support: superadmin_shop_health() (Mobile app:
 * supabase/migrations/20261111_device_status.sql) in one call, and the plain
 * list of what looks wrong.
 */

export interface DeviceReport {
  device_id: string
  user_id: string
  user_name: string | null
  user_role: string | null
  app: "mobile" | "desktop"
  platform: string | null
  device_label: string | null
  app_build: string | null
  native_version: string | null
  last_sync_at: string | null
  sync_ok: boolean | null
  last_error: string | null
  unsent_total: number
  unsent_on_hub: number
  unsent: Record<string, number>
  oldest_unsent_at: string | null
  licence_state: string | null
  clock_offset_ms: number | null
  hub: boolean | null
  reported_at: string
  /** Older than the newest build seen on any device lately. */
  behind: boolean | null
}

export interface ShopHealth {
  generated_at: string
  shop: { id: string; name: string; status: string; created_at: string; created_by: string | null; owner_name: string | null }
  licence: { expiry_date: string; status: string; is_trial: boolean | null; updated_at: string | null } | null
  payments: { count: number; total: number; last_amount: number | null; last_at: string | null } | null
  /** In the shop now, and its creator; `elsewhere`: signed in to another of their shops now. */
  people: { id: string; name: string; role: string; status: string | null; phone: string | null; email: string | null; last_seen: string | null; elsewhere?: boolean }[]
  devices: DeviceReport[]
  latest_builds: Record<string, string>
  server: {
    last_sale_at: string | null
    last_received_at: string | null
    sales_30d: number
    sales_without_items: number
    oldest_without_items: string | null
    products: number
  }
}

export async function loadShopHealth(shopId: string): Promise<ShopHealth> {
  const { data, error } = await supabase.rpc("superadmin_shop_health", { p_shop_id: shopId })
  if (error) {
    if (/superadmin_shop_health|device_status/i.test(error.message ?? "") || error.code === "PGRST202") {
      throw new Error("The shop health SQL (20261111_device_status.sql) has not been run on Supabase yet.")
    }
    throw new Error(explainError(error))
  }
  return data as ShopHealth
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago"; "never" for none. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never"
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return "—"
  if (ms < 2 * MIN) return "just now"
  if (ms < HOUR) return `${Math.round(ms / MIN)} minutes ago`
  if (ms < 2 * DAY) { const h = Math.round(ms / HOUR); return `${h} hour${h === 1 ? "" : "s"} ago` }
  return `${Math.round(ms / DAY)} days ago`
}

/** A build stamp (milliseconds, from version.json) as the day it was built. */
export function buildDate(stamp: string | null | undefined): string {
  const n = Number(stamp)
  return stamp && Number.isFinite(n) && n > 0 ? formatDate(new Date(n).toISOString()) : "unknown"
}

/** "4 sold items, 2 sales" */
export function describeUnsent(byTable: Record<string, number> | null | undefined): string {
  const LABELS: Record<string, [string, string]> = {
    sales: ["sale", "sales"], sale_items: ["sold item", "sold items"], products: ["product", "products"],
    expenses: ["expense", "expenses"], debt_payments: ["debt payment", "debt payments"], audit_logs: ["activity entry", "activity entries"],
    work_sessions: ["attendance block", "attendance blocks"], features: ["setting", "settings"], shops: ["shop detail", "shop details"],
    users: ["staff detail", "staff details"], stock_takes: ["stock take", "stock takes"], stock_take_items: ["stock take line", "stock take lines"],
    assistant_chats: ["AI chat message", "AI chat messages"],
  }
  return Object.entries(byTable ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n} ${(LABELS[t] ?? [t, t])[n === 1 ? 0 : 1]}`)
    .join(", ")
}

/** What the licence check on the device concluded, in words. */
export function licenceStateLabel(state: string | null | undefined): string {
  const LABELS: Record<string, string> = {
    VALID: "Valid",
    EXPIRED: "Expired: read-only",
    NO_LICENSE: "No licence: read-only",
    BLOCKED: "Blocked",
    TAMPERED: "Licence data changed on the device",
    DATE_MANIPULATED: "The device's date was changed",
    SYNC_REQUIRED: "Must go online to check its licence",
  }
  return state ? LABELS[state] ?? state : "Not checked yet"
}

export function deviceName(d: Pick<DeviceReport, "device_label" | "user_name">): string {
  return `${d.device_label || "A device"}${d.user_name ? ` (${d.user_name})` : ""}`
}

export interface Problem {
  level: "red" | "amber"
  text: string
  hint?: string
}

/** Everything that looks wrong, most serious first. */
export function findProblems(h: ShopHealth, now = Date.now()): Problem[] {
  const out: Problem[] = []
  const lic = h.licence
  if (!lic) {
    out.push({ level: "red", text: "No licence: the shop is read-only.", hint: "Renew it from Licences & Payments." })
  } else {
    const endsAt = new Date(lic.expiry_date).getTime()
    const left = Math.ceil((endsAt - now) / DAY)
    const endedDays = Math.floor((now - endsAt) / DAY)
    if (lic.status === "blocked") out.push({ level: "red", text: "The licence is blocked: the shop is read-only." })
    else if (endsAt <= now) out.push({ level: "red", text: `The licence ended on ${formatDate(lic.expiry_date)} (${endedDays === 0 ? "today" : `${endedDays} day${endedDays === 1 ? "" : "s"} ago`}): the shop is read-only.`, hint: "Renew it from Licences & Payments." })
    else if (left <= 7) out.push({ level: "amber", text: `The licence ends on ${formatDate(lic.expiry_date)} (in ${left} days).` })
  }

  if (h.server.sales_without_items > 0) {
    out.push({
      level: "red",
      text: `${h.server.sales_without_items} sale${h.server.sales_without_items === 1 ? "" : "s"} from the last 30 days reached the server without their sold items (oldest ${formatDate(h.server.oldest_without_items)}). History shows them with no products or quantities.`,
      hint: "The device that made them still holds the items: look for unsent sold items below. The new app version sends them again by itself.",
    })
  }

  for (const d of h.devices) {
    const name = deviceName(d)
    const stuckFor = d.oldest_unsent_at ? now - new Date(d.oldest_unsent_at).getTime() : 0
    if (d.unsent_total > 0 && stuckFor > DAY) {
      out.push({ level: "red", text: `${name} has ${d.unsent_total} item${d.unsent_total === 1 ? "" : "s"} waiting to be sent since ${formatDate(d.oldest_unsent_at)}: ${describeUnsent(d.unsent)}.` })
    }
    if (d.sync_ok === false) {
      out.push({ level: "red", text: `${name}: its last sync failed.`, hint: d.last_error ?? undefined })
    }
    if (now - new Date(d.reported_at).getTime() > 3 * DAY) {
      out.push({ level: "amber", text: `${name} has not been online since ${formatDate(d.reported_at)} (${ago(d.reported_at, now)}).` })
    }
    if (d.behind) {
      out.push({ level: "amber", text: `${name} runs an older version (built ${buildDate(d.app_build)}).`, hint: d.app === "mobile" ? "Install the new APK on it." : "Reload the page, or close and open the app." })
    }
    if (d.clock_offset_ms != null && Math.abs(d.clock_offset_ms) > 5 * MIN) {
      out.push({ level: "amber", text: `${name}'s clock is ${Math.round(Math.abs(d.clock_offset_ms) / MIN)} minutes ${d.clock_offset_ms > 0 ? "slow" : "fast"}.`, hint: "Set the date and time to automatic on the device." })
    }
    if (d.licence_state && !["VALID", "EXPIRED", "NO_LICENSE"].includes(d.licence_state)) {
      out.push({ level: "amber", text: `${name} sees the licence as: ${licenceStateLabel(d.licence_state)}.` })
    }
  }

  if (h.devices.length === 0) {
    out.push({ level: "amber", text: "No device has reported yet.", hint: "Devices report themselves after updating to the new app version (new APK, new Desktop)." })
  }
  const licenceOk = lic && lic.status === "active" && new Date(lic.expiry_date).getTime() > now
  const lastIn = h.server.last_received_at ? new Date(h.server.last_received_at).getTime() : null
  if (licenceOk && h.server.last_sale_at && lastIn && now - lastIn > 3 * DAY) {
    out.push({ level: "amber", text: `No sales have reached the server for ${Math.floor((now - lastIn) / DAY)} days.`, hint: "The shop may be closed, or its devices offline." })
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1))
}
