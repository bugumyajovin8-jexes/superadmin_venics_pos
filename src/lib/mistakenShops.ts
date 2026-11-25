import { supabase } from "@/src/lib/supabase"
import { matchesUser } from "@/src/lib/utils"

/**
 * People who opened a shop of their own and were later invited by another
 * shop: usually staff who signed up before their boss invited them. Their
 * invitation can never reach them on its own (they are already in a shop).
 *
 * superadmin_mistaken_shops() and superadmin_fix_mistaken_shop() come from
 * Mobile app/supabase/migrations/20261117_staff_signup.sql. Newer app versions
 * ask the person themselves; this list is for everyone else.
 */
export interface MistakeCheck {
  can_switch: boolean
  /** not_creator | sales | people | paid | other_shops */
  reasons: string[]
  sales: number
  people: number
  payments: number
  paid: boolean
  other_shops: number
  products: number
  records: number
}

export interface MistakenShop {
  user_id: string
  user_name: string | null
  phone: string | null
  signed_up_at: string | null
  /** What they answered at sign-up: "employee", "boss", or null (signed up before the question). */
  signup_role: string | null
  shop_id: string
  shop_name: string
  shop_created_at: string
  invitation_id: string
  invited_at: string
  inviting_shop_id: string
  inviting_shop_name: string
  check: MistakeCheck
}

const REASONS: Record<string, string> = {
  sales: "has sales",
  people: "has other staff",
  paid: "has a paid licence",
  other_shops: "they own other shops",
  not_creator: "they did not open it",
}

/** "has sales, has other staff" */
export function keptBecause(reasons: string[]): string {
  return reasons.map(r => REASONS[r] ?? r).join(", ") || "in use"
}

export function mistakeMatches(m: MistakenShop, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return matchesUser({ name: m.user_name ?? "", phone: m.phone, email: null }, q)
    || m.shop_name.toLowerCase().includes(q)
    || m.inviting_shop_name.toLowerCase().includes(q)
}

function explain(err: any): string {
  const message = String(err?.message ?? err ?? "")
  const missing = err?.code === "PGRST202" || /could not find the function/i.test(message)
  if (missing) return "The staff sign-up SQL (20261117_staff_signup.sql) has not been run on Supabase yet."
  if (/superadmin only/i.test(message)) return "Only a superadmin can do this. Sign in again."
  if (/in use/i.test(message)) return "That shop is in use now (it has sales, staff or a payment), so it was kept. Nothing changed."
  if (/invitation not found|inviting shop is gone/i.test(message)) return "That invitation no longer exists: the person may have joined already. Refresh the list."
  if (/nothing changed/i.test(message)) return message.charAt(0).toUpperCase() + message.slice(1) + "."
  if (/failed to fetch|network/i.test(message)) return "No connection to Supabase. Check the internet and try again."
  return message ? message.charAt(0).toUpperCase() + message.slice(1) + "." : "Something went wrong."
}

export async function loadMistakenShops(): Promise<MistakenShop[]> {
  const { data, error } = await supabase.rpc("superadmin_mistaken_shops")
  if (error) throw new Error(explain(error))
  return ((data ?? []) as MistakenShop[]).map(m => ({
    ...m,
    check: { ...m.check, products: Number(m.check?.products) || 0, records: Number(m.check?.records) || 0 },
  }))
}

/** The empty shop goes; the person becomes staff in the shop that invited them. */
export async function fixMistakenShop(invitationId: string): Promise<{ shop_name: string; removed_shop: { name: string } }> {
  const { data, error } = await supabase.rpc("superadmin_fix_mistaken_shop", { p_invitation: invitationId })
  if (error) throw new Error(explain(error))
  return data as any
}
