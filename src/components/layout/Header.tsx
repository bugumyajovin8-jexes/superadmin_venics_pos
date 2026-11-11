import { useEffect, useState } from "react"
import { Bell, Search, Store, User } from "lucide-react"
import { Button } from "@/src/components/ui/Button"
import { GlobalSearch } from "@/src/components/layout/GlobalSearch"
import type { SearchMode } from "@/src/lib/search"

interface HeaderProps {
  title: string
  search: { mode: SearchMode; placeholder: string }
  query: string
  onQueryChange: (q: string) => void
  onOpenShop: (shopId: string) => void
}

/**
 * The bar on top, with the one search bar for every page. On a computer: the
 * page's name and the search bar. On a phone: the brand, and a search button
 * that opens the search bar across the full width.
 */
export function Header({ title, search, query, onQueryChange, onOpenShop }: HeaderProps) {
  const [phoneSearch, setPhoneSearch] = useState(false)
  // A page change clears the search; on a phone, close the bar with it.
  useEffect(() => { if (!query) setPhoneSearch(false) }, [title])

  const bar = (autoFocus: boolean, className?: string) => (
    <GlobalSearch
      mode={search.mode}
      placeholder={search.placeholder}
      query={query}
      onChange={onQueryChange}
      onOpenShop={(id) => { setPhoneSearch(false); onOpenShop(id) }}
      autoFocus={autoFocus}
      className={className}
    />
  )

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-6">
        <h1 className="hidden shrink-0 text-2xl font-semibold text-slate-900 md:block">{title}</h1>
        <div className="flex items-center gap-2 font-bold text-indigo-600 md:hidden">
          <Store className="h-5 w-5" />
          <span>Venics Superadmin</span>
        </div>

        {bar(false, "hidden max-w-xl flex-1 md:block")}

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-600 md:hidden"
            aria-label="Open search"
            aria-expanded={phoneSearch}
            onClick={() => setPhoneSearch(v => !v)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="relative hidden text-slate-500 md:inline-flex">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </Button>

          <div className="flex items-center gap-2 md:border-l md:border-slate-200 md:pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden flex-col md:flex">
              <span className="text-sm font-medium text-slate-900">Admin User</span>
              <span className="text-xs text-slate-500">Superadmin</span>
            </div>
          </div>
        </div>
      </div>

      {(phoneSearch || query) && (
        <div className="flex items-center gap-2 px-4 pb-3 md:hidden" data-testid="phone-search">
          {bar(phoneSearch && !query, "flex-1")}
          <button onClick={() => { onQueryChange(""); setPhoneSearch(false) }} className="shrink-0 px-1 text-sm font-medium text-indigo-600">
            Close
          </button>
        </div>
      )}
    </header>
  )
}
