import { useSyncExternalStore } from "react"

/**
 * The look of the Superadmin, chosen per device (this browser only).
 *
 *   light   the default
 *   dark    near-black slate, indigo buttons
 *   purple  "Midnight Purple": a deep violet night, purple buttons
 *   system  follow the computer: light by day, and `night` (dark or purple)
 *           whenever Windows / the phone is set to dark
 *
 * The colours themselves live in src/themes.css: each theme recolours the
 * app's existing palette, so every page follows without changes of its own.
 * index.html applies the saved choice before the first paint (no flash).
 */
export type ThemeChoice = "light" | "dark" | "purple" | "system"
export type NightTheme = "dark" | "purple"
export type ResolvedTheme = "light" | NightTheme

export interface ThemeState {
  choice: ThemeChoice
  /** What "follow my computer" uses when the computer is dark. */
  night: NightTheme
}

const KEY = "sa_theme"
const DEFAULT: ThemeState = { choice: "light", night: "purple" }

function read(): ThemeState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null")
    if (saved && ["light", "dark", "purple", "system"].includes(saved.choice)) {
      return { choice: saved.choice, night: saved.night === "dark" ? "dark" : "purple" }
    }
  } catch { /* storage blocked or damaged: the default */ }
  return DEFAULT
}

const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null
const computerIsDark = () => !!media?.matches

export function resolve(state: ThemeState): ResolvedTheme {
  if (state.choice === "system") return computerIsDark() ? state.night : "light"
  return state.choice
}

let state = read()
let resolved = resolve(state)
const listeners = new Set<() => void>()

function apply() {
  resolved = resolve(state)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.classList.toggle("sa-night", resolved !== "light")
  root.style.colorScheme = resolved === "light" ? "light" : "dark"
  listeners.forEach(l => l())
}

if (typeof document !== "undefined") {
  apply()
  // "Follow my computer": change with it, live.
  media?.addEventListener?.("change", () => { if (state.choice === "system") apply() })
  // Another tab of the Superadmin changed it.
  window.addEventListener("storage", e => { if (e.key === KEY) { state = read(); apply() } })
}

export function setTheme(patch: Partial<ThemeState>) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* kept for this visit only */ }
  apply()
}

let snapshot = { ...state, resolved }
function getSnapshot() {
  if (snapshot.choice !== state.choice || snapshot.night !== state.night || snapshot.resolved !== resolved) {
    snapshot = { ...state, resolved }
  }
  return snapshot
}

/** The saved choice and what is showing now. */
export function useTheme(): ThemeState & { resolved: ResolvedTheme } {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    getSnapshot,
    getSnapshot,
  )
}

export const THEME_OPTIONS: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "White and grey, as always" },
  { value: "dark", label: "Dark", hint: "Near-black, easy at night" },
  { value: "purple", label: "Midnight Purple", hint: "Deep violet, purple buttons" },
  { value: "system", label: "Follow my computer", hint: "Light by day, dark when the computer is" },
]

/** Colours for the charts (drawn by recharts, so not reached by the stylesheet). */
export function chartColors(theme: ResolvedTheme) {
  if (theme === "dark") {
    return { grid: "#263041", tick: "#94a1b4", cursor: "#1a2233", tooltipBg: "#111827", tooltipText: "#f1f5f9", accent: "#818cf8", line: "#a78bfa" }
  }
  if (theme === "purple") {
    return { grid: "#36265f", tick: "#a99cd0", cursor: "#2a1c52", tooltipBg: "#1f1440", tooltipText: "#f4f0ff", accent: "#c084fc", line: "#e879f9" }
  }
  return { grid: "#e2e8f0", tick: "#64748b", cursor: "#f1f5f9", tooltipBg: "#ffffff", tooltipText: "#0f172a", accent: "#4f46e5", line: "#8b5cf6" }
}

/** recharts' tooltip box, in the theme's colours. */
export function tooltipStyle(theme: ResolvedTheme) {
  const c = chartColors(theme)
  return {
    contentStyle: { borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.2)", background: c.tooltipBg, color: c.tooltipText },
    labelStyle: { color: c.tooltipText },
    itemStyle: { color: c.tooltipText },
  }
}
