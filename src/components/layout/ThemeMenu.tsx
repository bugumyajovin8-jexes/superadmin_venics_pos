import { useEffect, useRef, useState } from "react"
import { Check, Monitor, Moon, Sparkles, Sun } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { THEME_OPTIONS, setTheme, useTheme, type ThemeChoice } from "@/src/lib/theme"

const ICONS: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, purple: Sparkles, system: Monitor }

/** Little colour dots for each theme: page, card, accent. */
export const SWATCH: Record<ThemeChoice, string[]> = {
  light: ["#f8fafc", "#ffffff", "#4f46e5"],
  dark: ["#0b1120", "#111827", "#6366f1"],
  purple: ["#150c2b", "#1f1440", "#a855f7"],
  system: ["#f8fafc", "#150c2b", "#a855f7"],
}

export function Swatch({ choice, className }: { choice: ThemeChoice; className?: string }) {
  const [page, card, accent] = SWATCH[choice]
  return (
    <span className={cn("inline-flex h-5 w-8 shrink-0 overflow-hidden rounded-md border border-slate-200", className)} aria-hidden="true">
      <span className="h-full flex-1" style={{ background: page }} />
      <span className="h-full flex-1" style={{ background: card }} />
      <span className="h-full flex-1" style={{ background: accent }} />
    </span>
  )
}

/** The theme button in the top bar: Light, Dark, Midnight Purple, or follow the computer. */
export function ThemeMenu() {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const Icon = ICONS[theme.choice]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close) }
  }, [open])

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Theme"
        aria-expanded={open}
        title="Theme"
        data-testid="theme-button"
      >
        <Icon className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" data-testid="theme-menu">
          {THEME_OPTIONS.map(o => {
            const OIcon = ICONS[o.value]
            const active = theme.choice === o.value
            return (
              <button
                key={o.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setTheme({ choice: o.value }); setOpen(false) }}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm", active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100")}
              >
                <OIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 font-medium">{o.label}</span>
                <Swatch choice={o.value} className="h-4 w-6" />
                {active ? <Check className="h-4 w-4 shrink-0" /> : <span className="w-4" />}
              </button>
            )
          })}
          {theme.choice === "system" && (
            <p className="px-2.5 pb-1 pt-2 text-xs text-slate-500">
              When the computer is dark: {theme.night === "dark" ? "Dark" : "Midnight Purple"}. Change it in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
