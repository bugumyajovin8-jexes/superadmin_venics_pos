import { Store, LogOut } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { supabase } from "@/src/lib/supabase"
import { NAV_ITEMS, SETTINGS_ITEM } from "@/src/components/layout/nav"

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

/** The desktop menu. On a phone it is replaced by MobileNav. */
export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const item = (id: string, label: string, Icon: typeof Store) => {
    const isActive = currentView === id
    return (
      <button
        key={id}
        onClick={() => onViewChange(id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <Icon className={cn("h-5 w-5", isActive ? "text-indigo-700" : "text-slate-400")} />
        {label}
      </button>
    )
  }

  return (
    <div className="hidden h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 md:flex">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl">
          <Store className="h-6 w-6" />
          <span>POS Superadmin</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map(n => item(n.id, n.label, n.icon))}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <nav className="space-y-1">
          {item(SETTINGS_ITEM.id, SETTINGS_ITEM.label, SETTINGS_ITEM.icon)}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 text-red-500" />
            Log out
          </button>
        </nav>
      </div>
    </div>
  )
}
