import { useEffect, useState } from "react"
import { AlertCircle, Loader2, MessageSquare, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { toast } from "@/src/components/ui/Toaster"
import { cn } from "@/src/lib/utils"
import { loadRenewalSms, saveRenewalSms } from "@/src/lib/settings"
import { explainError, renewalSmsText } from "@/src/lib/licences"

/** An on/off switch, announced as one to screen readers. */
function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-50",
        on ? "bg-indigo-600" : "bg-slate-300",
      )}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  )
}

export function SettingsView({ onOpen }: { onOpen?: (view: string) => void } = {}) {
  const [sms, setSms] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRenewalSms().then(setSms).catch(err => { setSms(false); setError(explainError(err)) })
  }, [])

  const change = async (on: boolean) => {
    setSaving(true)
    try {
      await saveRenewalSms(on)
      setSms(on)
      setError(null)
      toast.success(on ? "Owner SMS on renewal: on." : "Owner SMS on renewal: off.")
    } catch (err) {
      toast.error(`The setting was not saved: ${explainError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const example = renewalSmsText("Duka la Neema", new Date(Date.now() + 30 * 86_400_000))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="text-slate-500">How the dashboard works for you. Saved on Supabase, so the same on every computer.</p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-slate-400" />Owner SMS on renewal</CardTitle>
          <CardDescription>When this is on, renewing a licence can text the shop's owner. You can still untick it for any one renewal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="font-medium text-slate-900" data-testid="sms-setting-state">
                {sms === null ? "Checking…" : sms ? "On: owners get an SMS when you renew" : "Off: no SMS is sent"}
              </p>
              <p className="mt-1 text-sm text-slate-500">Needs the licence-sms function deployed on Supabase, with Beem set up.</p>
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              <Switch on={!!sms} disabled={sms === null || saving || !!error} onChange={change} label="Owner SMS on renewal" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">What the owner gets</p>
            <p className="mt-1 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{example}</p>
          </div>
        </CardContent>
      </Card>

      {onOpen && (
        <Card className="border-red-200" data-testid="danger-zone">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700"><ShieldAlert className="h-5 w-5" />Danger zone</CardTitle>
            <CardDescription>
              Delete Account permanently deletes a person's account and their shops' data. It is not on any menu,
              opens only with your password, and locks again after 10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => onOpen("delete-account")}>
              Open Delete Account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
