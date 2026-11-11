/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react"
import { Session } from "@supabase/supabase-js"
import { supabase } from "@/src/lib/supabase"
import { Sidebar } from "@/src/components/layout/Sidebar"
import { Header } from "@/src/components/layout/Header"
import { DashboardView } from "@/src/views/DashboardView"
import { ShopsView } from "@/src/views/ShopsView"
import { ShopDirectoryView } from "@/src/views/ShopDirectoryView"
import { ActiveShopsView } from "@/src/views/ActiveShopsView"
import { AnalyticsView } from "@/src/views/AnalyticsView"
import { BroadcastView } from "@/src/views/BroadcastView"
import { SystemHealthView } from "@/src/views/SystemHealthView"
import { LoginView } from "@/src/views/LoginView"
import { ShopProductsView } from "@/src/views/ShopProductsView"
import { DeleteAccountView } from "@/src/views/DeleteAccountView"
import { LicencesView } from "@/src/views/LicencesView"
import { SettingsView } from "@/src/views/SettingsView"
import { ShopHealthView } from "@/src/views/ShopHealthView"
import { Toaster } from "@/src/components/ui/Toaster"
import { MobileNav } from "@/src/components/layout/MobileNav"
import { DangerGate } from "@/src/components/DangerGate"
import { SEARCH, FIND_SHOP, SearchContext } from "@/src/lib/search"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [currentView, setCurrentView] = useState("dashboard")
  // The shop "Health" was opened for from Shop Management.
  const [healthShopId, setHealthShopId] = useState<string | null>(null)
  // The header's search bar: one for every page, cleared when the page changes.
  const [query, setQuery] = useState("")
  useEffect(() => { setQuery("") }, [currentView])
  const [isInitializing, setIsInitializing] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const checkUserRole = async (currentSession: Session | null) => {
      if (!currentSession) {
        setSession(null)
        setIsInitializing(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentSession.user.id)
          .single()

        if (error || !data || data.role !== 'superadmin') {
          console.error("Auth Error Details:", { error, data })
          await supabase.auth.signOut()
          setSession(null)
          setAuthError(error ? `Database Error: ${error.message}` : "Access denied. Only superadmins can log in to this dashboard.")
        } else {
          setSession(currentSession)
          setAuthError(null)
        }
      } catch (err) {
        console.error("Error checking role:", err)
        await supabase.auth.signOut()
        setSession(null)
        setAuthError("An error occurred while verifying your permissions.")
      }

      setIsInitializing(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUserRole(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkUserRole(session)
      } else {
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  if (!session) {
    return <LoginView externalError={authError} />
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView onOpen={setCurrentView} />
      case "shops":
        return <ShopsView onOpenHealth={(id) => { setHealthShopId(id); setCurrentView("shop-health") }} />
      case "shop-health":
        return <ShopHealthView initialShopId={healthShopId} />
      case "licences":
        return <LicencesView />
      case "settings":
        return <SettingsView onOpen={setCurrentView} />
      case "directory":
        return <ShopDirectoryView />
      case "products":
        return <ShopProductsView />
      case "delete-account":
        // Not on any menu: reached from Settings → Danger zone, and only with the password.
        return <DangerGate onLeave={() => setCurrentView("settings")}><DeleteAccountView /></DangerGate>
      case "active":
        return <ActiveShopsView />
      case "broadcast":
        return <BroadcastView />
      case "analytics":
        return <AnalyticsView />
      case "health":
        return <SystemHealthView />
      default:
        return <DashboardView onOpen={setCurrentView} />
    }
  }

  const getHeaderTitle = () => {
    switch (currentView) {
      case "dashboard": return "Overview"
      case "shops": return "Shop Management"
      case "licences": return "Licences & Payments"
      case "shop-health": return "Shop Health"
      case "settings": return "Settings"
      case "directory": return "Shop Directory"
      case "products": return "Shop Products"
      case "delete-account": return "Delete Account"
      case "active": return "Active Shops Today"
      case "broadcast": return "Broadcast Messages"
      case "analytics": return "Analytics & Metrics"
      case "health": return "System Health"
      default: return "Dashboard"
    }
  }

  return (
    // 100dvh: on a phone, the height the browser really shows (100vh runs under its address bar).
    <div className="flex h-[100dvh] w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title={getHeaderTitle()}
          search={SEARCH[currentView] ?? FIND_SHOP}
          query={query}
          onQueryChange={setQuery}
          onOpenShop={(id) => { setHealthShopId(id); setCurrentView("shop-health"); document.getElementById("main-scroll")?.scrollTo({ top: 0 }) }}
        />
        {/* On a phone, room at the bottom for the tab bar. */}
        <main id="main-scroll" className="flex-1 overflow-y-auto p-4 pb-24 md:p-6">
          <div className="mx-auto max-w-7xl">
            <SearchContext.Provider value={{ query, setQuery }}>
              {renderView()}
            </SearchContext.Provider>
          </div>
        </main>
      </div>
      <MobileNav currentView={currentView} onViewChange={(v) => { setCurrentView(v); document.getElementById("main-scroll")?.scrollTo({ top: 0 }) }} />
      <Toaster />
    </div>
  )
}

