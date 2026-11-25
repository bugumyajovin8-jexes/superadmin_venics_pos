import { AnalyticsView } from "@/src/views/AnalyticsView"
import { SystemHealthView } from "@/src/views/SystemHealthView"

/**
 * One page for how the apps are used: what shops do (features), what they ask
 * Mshauri AI and what it could not answer, and how much data moves to and
 * from Supabase (the cost). Was two pages: Analytics & Metrics and System Health.
 */
export function AppUsageView() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">App Usage</h2>
        <p className="text-slate-500">What the shops do in the apps, what they ask Mshauri AI, and how much data moves to and from Supabase.</p>
      </div>
      <section className="space-y-4" data-testid="usage-features">
        <h3 className="border-b border-slate-200 pb-2 text-xl font-bold text-slate-800">Features and Mshauri AI (last 30 days)</h3>
        <AnalyticsView embedded />
      </section>
      <section className="space-y-4" data-testid="usage-data">
        <h3 className="border-b border-slate-200 pb-2 text-xl font-bold text-slate-800">Data transfer (what Supabase charges for)</h3>
        <SystemHealthView embedded />
      </section>
    </div>
  )
}
