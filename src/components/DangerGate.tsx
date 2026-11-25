import { useEffect, useState, type ReactNode } from "react"
import { Loader2, Lock, ShieldAlert } from "lucide-react"
import { Card, CardContent } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { Input } from "@/src/components/ui/Input"
import { supabase } from "@/src/lib/supabase"

/**
 * In front of Delete Account: it opens only with the superadmin's password
 * and a typed phrase, and closes again by itself.
 *
 *   * The password is checked by Supabase (a fresh sign-in), which also
 *     records the time: the database then allows deletions for 15 minutes
 *     (20261111_delete_account_reauth.sql). The password is not kept.
 *   * 3 wrong passwords lock the page for 15 minutes on this computer.
 *   * Unlocked, it locks again after 10 minutes, or as soon as the superadmin
 *     leaves the page.
 */
const PHRASE = "DELETE ACCOUNTS"
const MAX_TRIES = 3
const LOCKOUT_MS = 15 * 60_000
const OPEN_MS = 10 * 60_000
const KEY = "sa_delete_gate"

function readFails(): { count: number; until: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}")
    return { count: Number(v.count) || 0, until: Number(v.until) || 0 }
  } catch {
    return { count: 0, until: 0 }
  }
}
function writeFails(v: { count: number; until: number }) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage blocked: the count lasts this visit */ }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function DangerGate({ children, onLeave }: { children: ReactNode; onLeave: () => void }) {
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null)
  const [password, setPassword] = useState("")
  const [phrase, setPhrase] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fails, setFails] = useState(readFails)
  const [now, setNow] = useState(Date.now())

  // A clock for the countdowns; and the page locks itself when its time is up.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (unlockedAt && now - unlockedAt >= OPEN_MS) setUnlockedAt(null)
  }, [now, unlockedAt])

  const lockedOutFor = fails.until - now
  const lockedOut = lockedOutFor > 0

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (lockedOut) return
    if (phrase.trim().toUpperCase() !== PHRASE) {
      setError(`Type ${PHRASE} in the second box, exactly.`)
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        setError("This superadmin account has no email and password, so the page cannot be opened from it.")
        return
      }
      const { error: wrong } = await supabase.auth.signInWithPassword({ email, password })
      if (wrong) {
        const count = fails.count + 1
        const next = count >= MAX_TRIES ? { count: 0, until: Date.now() + LOCKOUT_MS } : { count, until: 0 }
        writeFails(next)
        setFails(next)
        setError(count >= MAX_TRIES
          ? "Wrong password 3 times: Delete Account is locked for 15 minutes."
          : `Wrong password. ${MAX_TRIES - count} attempt${MAX_TRIES - count === 1 ? "" : "s"} left.`)
        return
      }
      writeFails({ count: 0, until: 0 })
      setFails({ count: 0, until: 0 })
      setUnlockedAt(Date.now())
    } catch {
      setError("Could not check the password. Check the connection and try again.")
    } finally {
      setPassword("")
      setBusy(false)
    }
  }

  if (unlockedAt) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800" data-testid="gate-open">
          <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 shrink-0" />
            Delete Account is open. It locks again in {mmss(OPEN_MS - (now - unlockedAt))}, or when you leave this page.
          </span>
          <Button variant="outline" size="sm" className="h-8 border-red-200 text-red-700" onClick={() => setUnlockedAt(null)}>
            <Lock className="mr-1 h-3.5 w-3.5" />Lock now
          </Button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4" data-testid="gate">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Lock className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Delete Account is locked</h2>
        <p className="mt-1 text-slate-500">
          This page permanently deletes a person's account and their shops' data. It cannot be undone.
        </p>
      </div>
      <Card>
        <CardContent className="p-5">
          <form onSubmit={unlock} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="gate-password" className="text-sm font-medium text-slate-700">Your superadmin password</label>
              <Input id="gate-password" type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} disabled={busy || lockedOut} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="gate-phrase" className="text-sm font-medium text-slate-700">
                Type <span className="font-mono font-semibold text-red-700">{PHRASE}</span>
              </label>
              <Input id="gate-phrase" autoComplete="off" spellCheck={false} value={phrase}
                onChange={e => setPhrase(e.target.value)} disabled={busy || lockedOut} className="font-mono uppercase placeholder:normal-case placeholder:font-sans" required />
            </div>
            {lockedOut ? (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700" data-testid="gate-lockout">
                Too many wrong passwords. Try again in {mmss(lockedOutFor)}.
              </p>
            ) : error && (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={onLeave} disabled={busy}>Back to Settings</Button>
              <Button type="submit" variant="destructive" disabled={busy || lockedOut} className="gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Unlock
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-slate-400">It locks again after 10 minutes, and whenever you leave it.</p>
    </div>
  )
}
