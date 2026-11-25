import { useState } from "react"
import { Activity, AlertCircle, Calendar, Loader2, MessageSquare } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { supabase, fetchAllRecords } from "@/src/lib/supabase"

/**
 * What one shop does in the apps, for Shop Health: its last Mshauri AI chats
 * and which features it uses. Moved here from the old Shop Directory page.
 * Each loads only when asked for, so opening Shop Health stays light.
 */

interface AssistantChat {
  id: string
  message_type: "user" | "assistant" | "system"
  content: string
  is_unresolved: boolean
  created_at: string
  metadata: any
}

const TELEMETRY_LABELS: Record<string, string> = {
  pos_checkout: "Sales",
  mshauri_ai_advisor: "Chatbot",
  debt_payments_clearance: "Debts",
  expenses_tracker: "Expenses",
  bulk_product_import: "Excel",
  saas_feature_flag_toggle: "Features",
  product_expiry_tracker: "Expiry",
  camera_product_scan: "Camera AI",
  instant_product_message_share: "Quick product entrance",
  backdated_sale: "Backdate Sales",
  backdated_expense: "Backdate expenses",
  mabadiliko_ya_bidhaa: "Stock changes",
  employee_reports_view: "Employee reports",
  add_staff: "Add Employee",
  stock_valuation_checked: "Total Business Value",
  refund_sale: "Refund Sale",
  whatsapp_debt_reminder: "Whatsapp Debt",
}

export function ShopAiChats({ shopId }: { shopId: string }) {
  const [chats, setChats] = useState<AssistantChat[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // Only the last 10 messages, newest first: enough to help with a
      // question, without reading a shop's whole conversation history.
      const { data, error } = await supabase
        .from("assistant_chats")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      setChats(data || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load the chats")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card data-testid="shop-ai-chats">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-slate-400" />Mshauri AI chats</CardTitle>
          <CardDescription>The last 10 messages, newest first.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 shrink-0">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {chats ? "Refresh" : "Show chats"}
        </Button>
      </CardHeader>
      {(chats || error) && (
        <CardContent>
          {error ? (
            <p className="flex items-center gap-2 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</p>
          ) : chats!.length === 0 ? (
            <p className="text-sm text-slate-500">No AI chats for this shop.</p>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="chats-list">
              <p className="text-center text-xs text-slate-500" data-testid="chats-note">The last {chats!.length} message{chats!.length === 1 ? "" : "s"}, newest first.</p>
              {chats!.map(chat => {
                const isUser = chat.message_type === "user"
                if (chat.message_type === "system") {
                  return (
                    <div key={chat.id} className="flex justify-center">
                      <span className="flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 font-mono text-[10px] text-slate-600">
                        <Calendar className="h-3 w-3" />{new Date(chat.created_at).toLocaleString()}
                      </span>
                    </div>
                  )
                }
                return (
                  <div key={chat.id} className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? "rounded-br-none bg-indigo-600 text-white" : "rounded-bl-none border border-slate-200 bg-white text-slate-800 shadow-sm"}`}>
                      {chat.content}
                      {chat.is_unresolved && !isUser && (
                        <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 text-xs font-medium text-red-500">
                          <AlertCircle className="h-3 w-3" /> Flagged as unresolved
                        </div>
                      )}
                    </div>
                    <div className="px-1 text-[10px] text-slate-500">
                      {new Date(chat.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {chat.metadata?.intent && ` · Intent: ${chat.metadata.intent}`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function ShopFeatureUsage({ shopId }: { shopId: string }) {
  const [usage, setUsage] = useState<{ name: string; count: number; lastUsed: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllRecords(supabase.from("saas_telemetry").select("feature_key, created_at").eq("shop_id", shopId))
      const map: Record<string, { count: number; lastUsed: string }> = {}
      for (const r of data as any[]) {
        const key = TELEMETRY_LABELS[r.feature_key] || r.feature_key
        const m = (map[key] ??= { count: 0, lastUsed: r.created_at })
        m.count += 1
        if (r.created_at > m.lastUsed) m.lastUsed = r.created_at
      }
      setUsage(Object.entries(map).map(([name, m]) => ({ name, ...m })).sort((a, b) => b.count - a.count))
    } catch (err: any) {
      setError(err?.message || "Failed to load feature usage")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card data-testid="shop-feature-usage">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-slate-400" />Features used</CardTitle>
          <CardDescription>What this shop does in the apps, most used first.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 shrink-0">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {usage ? "Refresh" : "Show features"}
        </Button>
      </CardHeader>
      {(usage || error) && (
        <CardContent>
          {error ? (
            <p className="flex items-center gap-2 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</p>
          ) : usage!.length === 0 ? (
            <p className="text-sm text-slate-500">No feature use recorded for this shop.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200" data-testid="usage-list">
              {usage!.map((u, i) => (
                <li key={u.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-bold text-indigo-600">{i + 1}</span>
                    <span>
                      <span className="block font-medium text-slate-900">{u.name}</span>
                      <span className="block text-xs text-slate-500">Last used {new Date(u.lastUsed).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-lg font-bold text-indigo-700">{u.count}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">times</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}
