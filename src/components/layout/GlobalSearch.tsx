import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Search, Store, X } from "lucide-react"
import { cn, formatTzPhone } from "@/src/lib/utils"
import { type LicenceShop, contactFor, daysFromNow, describeDays, loadLicenceShops, shopMatches } from "@/src/lib/licences"
import type { SearchMode } from "@/src/lib/search"

// Shops and their owners, read once and kept for a few minutes: searching is instant.
let cache: { at: number; shops: LicenceShop[] } | null = null
async function shopsForSearch(): Promise<LicenceShop[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.shops
  const shops = await loadLicenceShops()
  cache = { at: Date.now(), shops }
  return shops
}

function licenceChip(s: LicenceShop): { text: string; tone: string } {
  if (!s.licence) return { text: "No licence", tone: "bg-amber-50 text-amber-700" }
  const d = daysFromNow(s.licence.expiry_date)
  if (d < 0) return { text: `Ended ${describeDays(d)}`, tone: "bg-red-50 text-red-700" }
  if (d <= 7) return { text: `Ends ${describeDays(d)}`, tone: "bg-amber-50 text-amber-700" }
  return { text: s.licence.is_trial ? "On trial" : "Paid", tone: "bg-emerald-50 text-emerald-700" }
}

/**
 * The header's search bar. On a list page it filters the list as you type;
 * elsewhere it lists matching shops, and choosing one opens its health.
 * Ctrl+K (or /) jumps to it from anywhere; Escape clears it.
 */
export function GlobalSearch({
  mode, placeholder, query, onChange, onOpenShop, autoFocus = false, className,
}: {
  mode: SearchMode
  placeholder: string
  query: string
  onChange: (q: string) => void
  onOpenShop: (shopId: string) => void
  autoFocus?: boolean
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [shops, setShops] = useState<LicenceShop[] | null>(cache?.shops ?? null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // Ctrl+K or "/" anywhere (but not while typing in another field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "")
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // A click elsewhere closes the list.
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const ensureShops = () => {
    if (mode !== "find" || shops || loading) return
    setLoading(true)
    shopsForSearch().then(s => { setShops(s); setFailed(false) }).catch(() => setFailed(true)).finally(() => setLoading(false))
  }

  const results = useMemo(
    () => (mode === "find" && query.trim() && shops ? shops.filter(s => shopMatches(s, query)).slice(0, 8) : []),
    [mode, query, shops],
  )
  useEffect(() => { setActive(0) }, [query])

  const choose = (s: LicenceShop) => {
    setOpen(false)
    onChange("")
    onOpenShop(s.id)
  }

  const showList = mode === "find" && open && query.trim().length > 0

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={input}
        type="search"
        role={mode === "find" ? "combobox" : undefined}
        aria-label="Search"
        aria-expanded={mode === "find" ? showList : undefined}
        aria-controls={mode === "find" ? "global-search-results" : undefined}
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); ensureShops() }}
        onChange={e => { onChange(e.target.value); setOpen(true); ensureShops() }}
        onKeyDown={e => {
          if (e.key === "Escape") { onChange(""); setOpen(false); return }
          if (!showList || results.length === 0) return
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          if (e.key === "Enter") { e.preventDefault(); choose(results[active]) }
        }}
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {query ? (
          <button onClick={() => { onChange(""); input.current?.focus() }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 lg:inline">Ctrl K</kbd>
        )}
      </div>

      {showList && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg" data-testid="search-results">
          {loading && !shops ? (
            <p className="flex items-center gap-2 p-3 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading shops…</p>
          ) : failed ? (
            <p className="p-3 text-sm text-red-700">Could not load the shops. Check the connection and try again.</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No shop matches “{query.trim()}”.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((s, i) => {
                const c = contactFor(s)
                const chip = licenceChip(s)
                return (
                  <li key={s.id} role="option" aria-selected={i === active}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(s)}
                      className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-indigo-50")}
                    >
                      <Store className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{s.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {c?.name || s.owner_name || "No owner"}{c?.phone ? ` · ${formatTzPhone(c.phone)}` : c?.email ? ` · ${c.email}` : ""}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", chip.tone)}>{chip.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
