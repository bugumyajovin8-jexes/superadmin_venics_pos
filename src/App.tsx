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
import { AnalyticsView } from "@/src/views/AnalyticsView"
import { SystemHealthView } from "@/src/views/SystemHealthView"
import { LoginView } from "@/src/views/LoginView"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [currentView, setCurrentView] = useState("dashboard")
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
        return <DashboardView />
      case "shops":
        return <ShopsView />
      case "directory":
        return <ShopDirectoryView />
      case "analytics":
        return <AnalyticsView />
      case "health":
        return <SystemHealthView />
      default:
        return <DashboardView />
    }
  }

  const getHeaderTitle = () => {
    switch (currentView) {
      case "dashboard": return "Overview"
      case "shops": return "Shop Management"
      case "directory": return "Shop Directory"
      case "analytics": return "Analytics & Metrics"
      case "health": return "System Health"
      default: return "Dashboard"
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={getHeaderTitle()} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  )
}

