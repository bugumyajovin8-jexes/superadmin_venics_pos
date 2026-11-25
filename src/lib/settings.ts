import { useEffect, useState } from "react"
import { supabase } from "@/src/lib/supabase"

/**
 * The Superadmin's own switches, kept in public.superadmin_settings (Mobile
 * app: supabase/migrations/20261111_superadmin_dashboard.sql), so they are the
 * same on every computer the superadmin signs in on.
 *
 * renewal_sms: whether renewing a licence texts the owner. Off unless it has
 * been switched on: the SMS is optional, and a missing or unreadable setting
 * never sends texts nobody asked for.
 */

let renewalSms: boolean | null = null
const listeners = new Set<(on: boolean) => void>()
const tell = (on: boolean) => { renewalSms = on; listeners.forEach(l => l(on)) }

export async function loadRenewalSms(): Promise<boolean> {
  const { data, error } = await supabase
    .from("superadmin_settings")
    .select("value")
    .eq("key", "renewal_sms")
    .maybeSingle()
  if (error) throw error
  const on = data?.value?.enabled === true
  tell(on)
  return on
}

export async function saveRenewalSms(enabled: boolean): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase
    .from("superadmin_settings")
    .upsert(
      { key: "renewal_sms", value: { enabled }, updated_at: new Date().toISOString(), updated_by: session?.user?.id ?? null },
      { onConflict: "key" },
    )
  if (error) throw error
  tell(enabled)
}

/** Whether the owner SMS is on: null while it is being read, false if it cannot be. */
export function useRenewalSms(): boolean | null {
  const [on, setOn] = useState<boolean | null>(renewalSms)
  useEffect(() => {
    listeners.add(setOn)
    if (renewalSms === null) loadRenewalSms().catch(() => setOn(false))
    return () => { listeners.delete(setOn) }
  }, [])
  return on
}
