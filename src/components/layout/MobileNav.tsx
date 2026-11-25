import { useEffect, useState } from "react"
import { LogOut, Menu, X } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { supabase } from "@/src/lib/supabase"
import { NAV_ITEMS, PHONE_TABS, SETTINGS_ITEM } from "@/src/components/layout/nav"

/**
 * The phone's navigation: tabs at the bottom, where a thumb reaches, for the
 * pages used away from a desk (Overview, Licences, Health, Shops), and "Menu"
 * for everything else. Hidden from the tablet width up, where the sidebar is.
 */
export function MobileNav({ currentView, onViewChange }: { currentView: string; onViewChange: (view: string) => void }) {
  const [open, setOpen] = useState(false)
  const tabs = PHONE_TABS.map(id => NAV_ITEMS.find(n => n.id === id)!)
  const inMenu = !PHONE_TABS.includes(currentView as any)

  // Back button / Escape closes the menu rather than leaving the app.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const go = (id: string) => { onViewChange(id); setOpen(false) }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {tabs.map(t => {
            const active = currentView === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-indigo-600" : "text-slate-500")}
              >
                <Icon className="h-5 w-5" />
                {t.short}
              </button>
            )
          })}
          <button
            onClick={() => setOpen(true)}
            aria-label="Menu"
            aria-expanded={open}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", inMenu ? "text-indigo-600" : "text-slate-500")}
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">All pages</p>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-slate-100" aria-label="Close menu">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...NAV_ITEMS, SETTINGS_ITEM].map(n => {
                const Icon = n.icon
                const active = currentView === n.id
                return (
                  <button
                    key={n.id}
                    onClick={() => go(n.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium",
                      active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 active:bg-slate-50",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {n.label}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 py-3 text-sm font-medium text-red-600 active:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  )
}
