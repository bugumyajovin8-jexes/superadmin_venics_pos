import { useEffect, useState } from "react"
import { AlertCircle, Loader2, MessageSquare, Palette, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { toast } from "@/src/components/ui/Toaster"
import { cn } from "@/src/lib/utils"
import { loadRenewalSms, saveRenewalSms } from "@/src/lib/settings"
import { explainError, renewalSmsText } from "@/src/lib/licences"
import { THEME_OPTIONS, setTheme, useTheme } from "@/src/lib/theme"
import { Swatch } from "@/src/components/layout/ThemeMenu"

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
  const theme = useTheme()
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
        <p className="text-slate-500">How the dashboard works for you.</p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card data-testid="appearance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-slate-400" />Appearance</CardTitle>
          <CardDescription>The colours of this dashboard. Saved on this computer or phone only, so each device can have its own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(o => {
              const active = theme.choice === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme({ choice: o.value })}
                  className={cn("rounded-xl border-2 p-3 text-left transition-colors", active ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-slate-300")}
                  data-testid={`theme-${o.value}`}
                >
                  <Swatch choice={o.value} className="h-8 w-full" />
                  <p className={cn("mt-2 text-sm font-semibold", active ? "text-indigo-700" : "text-slate-900")}>{o.label}</p>
                  <p className="text-xs text-slate-500">{o.hint}</p>
                </button>
              )
            })}
          </div>
          {theme.choice === "system" && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="night-choice">
              <div>
                <p className="font-medium text-slate-900">When the computer is dark, use</p>
                <p className="text-sm text-slate-500">
                  Now showing: {theme.resolved === "light" ? "Light (the computer is light)" : theme.resolved === "dark" ? "Dark" : "Midnight Purple"}
                </p>
              </div>
              <div className="flex gap-2">
                {(["dark", "purple"] as const).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTheme({ night: n })}
                    aria-pressed={theme.night === n}
                    className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", theme.night === n ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 hover:bg-slate-100")}
                    data-testid={`night-${n}`}
                  >
                    <Swatch choice={n} className="h-4 w-6" />
                    {n === "dark" ? "Dark" : "Midnight Purple"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-slate-400" />Owner SMS on renewal</CardTitle>
          <CardDescription>When this is on, renewing a licence can text the shop's owner. You can still untick it for any one renewal. Saved on Supabase, so the same on every computer.</CardDescription>
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
