import { supabase } from "@/src/lib/supabase"
import { explainError } from "@/src/lib/licences"

/**
 * The dashboard's figures, worked out on the server by superadmin_overview()
 * (Mobile app: supabase/migrations/20261111_superadmin_dashboard.sql) in one
 * call, instead of downloading every sale into the browser.
 */
export interface Overview {
  generated_at: string
  shops: {
    total: number
    paying: number
    trial: number
    trial_ended: number
    ending_7d: number
    ended_30d: number
    lost: number
    lost_90d: number
    blocked: number
    no_licence: number
    trials_90d: number
    converted_90d: number
    trials_all: number
    converted_all: number
  }
  income: {
    this_month: number
    last_month: number
    payments_this_month: number
    free_days_this_month: number
    first_payment_at: string | null
    months: { month: string; amount: number }[]
  }
  /** From the daily sales totals; null until 20261104_sales_daily_and_history.sql has been run. */
  activity: {
    shops_today: number
    shops_7d: number
    users_today: number
    sales_this_month: number
  } | null
}

export async function loadOverview(): Promise<Overview> {
  const { data, error } = await supabase.rpc("superadmin_overview")
  if (error) throw new Error(explainError(error))
  const o = data as Overview
  // numeric arrives as text or number depending on the size: always numbers here.
  o.income.this_month = Number(o.income.this_month) || 0
  o.income.last_month = Number(o.income.last_month) || 0
  o.income.months = (o.income.months ?? []).map(m => ({ month: m.month, amount: Number(m.amount) || 0 }))
  if (o.activity) o.activity.sales_this_month = Number(o.activity.sales_this_month) || 0
  return o
}

/** "2026-11" -> "Nov" */
export function monthShort(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short" })
}

/** 1 of 3 -> "33%"; nothing to measure -> "—". */
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—"
}
