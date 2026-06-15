import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { MetricCard } from "@/src/components/ui/MetricCard"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts"
import { Users, CreditCard, Clock, TrendingUp, Heart, MessageSquare, Activity, AlertCircle, HelpCircle, List, Filter } from "lucide-react"
import { Button } from "@/src/components/ui/Button"
import { Modal } from "@/src/components/ui/Modal"

const COLORS = ['#4f46e5', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#fcd34d', '#a78bfa', '#fb923c'];

export function AnalyticsView() {
  const [topMerchants, setTopMerchants] = useState<any[]>([])
  const [peakSalesData, setPeakSalesData] = useState<any[]>([])
  
  // Telemetry state
  const [featureUsage, setFeatureUsage] = useState<any[]>([])
  const [dailyUsage, setDailyUsage] = useState<any[]>([])
  const [leastUsed, setLeastUsed] = useState<any[]>([])
  
  // AI Insights state
  const [topQuestions, setTopQuestions] = useState<any[]>([])
  const [unresolvedQuestions, setUnresolvedQuestions] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  // Feature usage modal state
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false)
  const [allFeatureUsage, setAllFeatureUsage] = useState<any[]>([])
  const [featureSortBy, setFeatureSortBy] = useState('most_used')
  const [featureTimeRange, setFeatureTimeRange] = useState('30days')
  const [loadingModalData, setLoadingModalData] = useState(false)

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true)
      try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const isoThirtyDaysAgo = thirtyDaysAgo.toISOString()

        // 1. Fetch Sales (legacy code)
        const { data: sales } = await supabase
          .from('sales')
          .select('shop_id, total_amount, created_at, shops(name)')
          .gte('created_at', isoThirtyDaysAgo)
          .eq('status', 'completed')

        if (sales) {
          const shopTotals: Record<string, { name: string, sales: number }> = {}
          sales.forEach((sale: any) => {
            const shopName = Array.isArray(sale.shops) ? sale.shops[0]?.name : sale.shops?.name || 'Unknown Shop'
            if (!shopTotals[shopName]) shopTotals[shopName] = { name: shopName, sales: 0 }
            shopTotals[shopName].sales += (sale.total_amount || 0)
          })
          setTopMerchants(Object.values(shopTotals).sort((a, b) => b.sales - a.sales).slice(0, 5))

          const hourlyData: Record<number, number> = {}
          for (let i = 0; i < 24; i++) hourlyData[i] = 0
          sales.forEach(sale => {
            const hour = new Date(sale.created_at).getHours()
            hourlyData[hour] += (sale.total_amount || 0)
          })
          setPeakSalesData(Object.keys(hourlyData).map(hourStr => {
            const hour = parseInt(hourStr)
            return {
              time: `${hour % 12 || 12}${hour >= 12 ? 'pm' : 'am'}`,
              sales: hourlyData[hour]
            }
          }))
        }

        // 2. Fetch SaaS Telemetry limit to last 30 days
        const { data: telemetry, error: telemetryError } = await supabase
          .from('saas_telemetry')
          .select('feature_key, created_at')
          .gte('created_at', isoThirtyDaysAgo)

        if (telemetryError) throw telemetryError;

        if (telemetry) {
          const usageCount: Record<string, number> = {}
          const dailyCount: Record<string, number> = {}

          const TELEMETRY_LABELS: Record<string, string> = {
            pos_checkout: "Sales",
            mshauri_ai_advisor: "Chatbot",
            debt_payments_clearance: "Debts",
            expenses_tracker: "Expenses",
            bulk_product_import: "Excel",
            saas_feature_flag_toggle: "Features",
            product_expiry_tracker: "Expiry",
            camera_product_scan: "Camera AI",
            instant_product_message_share: "Quick product entrance",
            backdated_sale: "Backdate Sales",
            backdated_expense: "Backdate expenses",
            mabadiliko_ya_bidhaa: "Stock changes",
            employee_reports_view: "Employee reports",
            add_staff: "Add Employee",
            stock_valuation_checked: "Total Business Value",
            refund_sale: "Refund Sale",
            whatsapp_debt_reminder: "Whatsapp Debt"
          }

          telemetry.forEach((t: any) => {
            const rawKey = t.feature_key;
            const key = TELEMETRY_LABELS[rawKey] || rawKey;
            
            usageCount[key] = (usageCount[key] || 0) + 1

            // YYYY-MM-DD
            const dateStr = new Date(t.created_at).toISOString().split('T')[0]
            dailyCount[dateStr] = (dailyCount[dateStr] || 0) + 1
          })


          const usageArray = Object.keys(usageCount).map(k => ({ name: k, count: usageCount[k] }))
          // Top used
          setFeatureUsage(usageArray.sort((a, b) => b.count - a.count).slice(0, 10))
          // Least used
          setLeastUsed([...usageArray].sort((a, b) => a.count - b.count).slice(0, 5))

          // Daily trends
          const dailyArray = Object.keys(dailyCount).sort().map(d => {
             const date = new Date(d)
             return {
               date: `${date.getMonth()+1}/${date.getDate()}`,
               actionCount: dailyCount[d]
             }
          })
          setDailyUsage(dailyArray)
        }

        // 3. Fetch AI Chats
        const { data: chats, error: chatsError } = await supabase
          .from('assistant_chats')
          .select('message_type, content, is_unresolved, metadata, created_at')
          .in('message_type', ['user', 'assistant'])
          .gte('created_at', isoThirtyDaysAgo)

        if (chatsError) throw chatsError;

        if (chats) {
          const questionCounts: Record<string, number> = {}
          const unresolvedCounts: Record<string, number> = {}

          chats.forEach((c: any) => {
            if (c.message_type === 'user') {
               const text = (c.content || '').trim().toLowerCase()
               if (!text) return
               questionCounts[text] = (questionCounts[text] || 0) + 1
               // Some user messages might be marked unresolved directly
               if (c.is_unresolved) {
                 unresolvedCounts[text] = (unresolvedCounts[text] || 0) + 1
               }
            } else if (c.message_type === 'assistant' && c.is_unresolved) {
               // Assistant replies often carry the unresolved flag and the query in metadata
               const query = (c.metadata?.query || '').trim().toLowerCase()
               if (query) {
                 unresolvedCounts[query] = (unresolvedCounts[query] || 0) + 1
               } else {
                 // Fallback if no specific query is logged
                 unresolvedCounts['[Unknown User Query]'] = (unresolvedCounts['[Unknown User Query]'] || 0) + 1
               }
            }
          })

          // Top Asked Questions
          const topQ = Object.keys(questionCounts)
             .map(q => ({ question: q, count: questionCounts[q] }))
             .sort((a, b) => b.count - a.count)
             .slice(0, 10)
          setTopQuestions(topQ)

          // Top Unresolved Questions
          const unresQ = Object.keys(unresolvedCounts)
             .map(q => ({ question: q, count: unresolvedCounts[q] }))
             .sort((a, b) => b.count - a.count)
             .slice(0, 10)
          setUnresolvedQuestions(unresQ)
        }

      } catch (error: any) {
        console.error("Error fetching analytics:", error)
        setAnalyticsError(error.message || "Failed to load analytics")
      }
      setLoading(false)
    }

    fetchAnalytics()
  }, [])

  useEffect(() => {
    if (isFeatureModalOpen) {
      async function fetchModalFeatureData() {
        setLoadingModalData(true)
        try {
          let query = supabase.from('saas_telemetry').select('feature_key, created_at');
          
          if (featureTimeRange !== 'all') {
            const dateLimit = new Date();
            if (featureTimeRange === '7days') dateLimit.setDate(dateLimit.getDate() - 7);
            if (featureTimeRange === '30days') dateLimit.setDate(dateLimit.getDate() - 30);
            query = query.gte('created_at', dateLimit.toISOString());
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          if (data) {
            const usageCount: Record<string, number> = {};
            const lastUsed: Record<string, string> = {};

            const TELEMETRY_LABELS: Record<string, string> = {
              pos_checkout: "Sales",
              mshauri_ai_advisor: "Chatbot",
              debt_payments_clearance: "Debts",
              expenses_tracker: "Expenses",
              bulk_product_import: "Excel",
              saas_feature_flag_toggle: "Features",
              product_expiry_tracker: "Expiry",
              camera_product_scan: "Camera AI",
              instant_product_message_share: "Quick product entrance",
              backdated_sale: "Backdate Sales",
              backdated_expense: "Backdate expenses",
              mabadiliko_ya_bidhaa: "Audit Logs",
              employee_reports_view: "Employee reports",
              add_staff: "Add Employee",
              stock_valuation_checked: "Total Business Value",
              refund_sale: "Refund Sale",
              whatsapp_debt_reminder: "Whatsapp Debt"
            }
            
            data.forEach((t: any) => {
              const rawKey = t.feature_key;
              const key = TELEMETRY_LABELS[rawKey] || rawKey;
              usageCount[key] = (usageCount[key] || 0) + 1;

              if (!lastUsed[key] || new Date(t.created_at) > new Date(lastUsed[key])) {
                lastUsed[key] = t.created_at;
              }
            });
            
            let result = Object.keys(usageCount).map(k => ({
              name: k,
              count: usageCount[k],
              last_used: lastUsed[k]
            }));
            
            setAllFeatureUsage(result);
          }
        } catch (error) {
           console.error("Error fetching modal features:", error);
        } finally {
           setLoadingModalData(false);
        }
      }
      fetchModalFeatureData();
    }
  }, [isFeatureModalOpen, featureTimeRange])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics & Metrics</h2>
        <p className="text-slate-500">Deep dive into customer behavior, retention, and AI assistant performance.</p>
      </div>

      {analyticsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
           <AlertCircle className="h-5 w-5 shrink-0" />
           <p className="text-sm font-medium">Failed to load some analytics data: {analyticsError}</p>
        </div>
      )}

      {/* Basic Metrics row... */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Avg Transactions / Day"
          value="14,205"
          icon={<CreditCard className="h-4 w-4" />}
          trend={{ value: 8.2, label: "from last week", isPositive: true }}
        />
        <MetricCard
          title="Avg Time on Platform"
          value="4h 12m"
          icon={<Clock className="h-4 w-4" />}
          trend={{ value: 1.5, label: "from last week", isPositive: true }}
        />
        <MetricCard
          title="Feature Engagement"
          value={featureUsage.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          trend={{ value: 5.3, label: "from last month", isPositive: true }}
        />
        <MetricCard
          title="Unresolved AI Queries"
          value={unresolvedQuestions.reduce((acc, curr) => acc + curr.count, 0).toString()}
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          trend={{ value: 1.2, label: "increase from yesterday", isPositive: false }}
        />
      </div>

      {/* SaaS Feature Telemetry */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Platform Actions (Telemetry)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Daily Action Volume</CardTitle>
              <CardDescription>Total captured metrics across all features (Last 30 Days)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-slate-500">Loading data...</div>
                ) : dailyUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="actionCount" name="Total Actions" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3, fill: '#8b5cf6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">No telemetry data.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle>Top Used Features</CardTitle>
                <CardDescription>Aggregate ranking all time</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsFeatureModalOpen(true)} className="h-8 shadow-sm">
                <List className="h-4 w-4 mr-1.5 text-slate-500" /> 
                <span className="text-xs">View All</span>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] overflow-y-auto pr-2 space-y-4">
                {loading ? (
                   <div className="text-sm text-slate-500">Loading...</div>
                ) : featureUsage.length > 0 ? (
                  featureUsage.map((feat, i) => (
                    <div key={feat.name} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-800 truncate" title={feat.name}>{i+1}. {feat.name}</span>
                        <span className="text-slate-500">{feat.count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (feat.count / featureUsage[0].count) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                ) : <div className="text-sm text-slate-500">No features tracked.</div>}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* AI Bot Analytics */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-purple-600" />
          Mshauri AI Insights
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          
          <Card>
            <CardHeader>
              <CardTitle>Top Asked Questions</CardTitle>
              <CardDescription>Most repeated user inquiries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium rounded-l-md w-10">Rank</th>
                      <th className="py-2 px-3 text-left font-medium">Question / Prompt</th>
                      <th className="py-2 px-3 text-right font-medium rounded-r-md">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={3} className="py-4 text-center text-slate-500">Loading...</td></tr>
                    ) : topQuestions.length > 0 ? (
                      topQuestions.map((q, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-medium text-slate-900">{i + 1}</td>
                          <td className="py-3 px-3 text-slate-600 max-w-[250px] truncate" title={q.question}>"{q.question}"</td>
                          <td className="py-3 px-3 text-right">
                             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                                {q.count}
                             </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-500">No chat data found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-red-50/10">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Failing Queries (Unresolved)</CardTitle>
              <CardDescription>Repeated questions the AI failed to answer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-red-600">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium rounded-l-md w-10">Rank</th>
                      <th className="py-2 px-3 text-left font-medium">Question / Intent</th>
                      <th className="py-2 px-3 text-right font-medium rounded-r-md">Failures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {loading ? (
                       <tr><td colSpan={3} className="py-4 text-center text-slate-500">Loading...</td></tr>
                    ) : unresolvedQuestions.length > 0 ? (
                      unresolvedQuestions.map((q, i) => (
                        <tr key={i}>
                          <td className="py-3 px-3 font-medium text-red-900">{i + 1}</td>
                          <td className="py-3 px-3 text-red-800 max-w-[250px] truncate" title={q.question}>"{q.question}"</td>
                          <td className="py-3 px-3 text-right">
                             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                {q.count}
                             </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-emerald-600">
                           <div className="flex flex-col items-center justify-center gap-2">
                              <Heart className="h-6 w-6" />
                              <span>No unresolved queries! The bot is doing great.</span>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      <Modal
        isOpen={isFeatureModalOpen}
        onClose={() => setIsFeatureModalOpen(false)}
        title="All Tracked Features"
        className="max-w-3xl"
      >
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
             <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Time Range:</span>
                <select
                  value={featureTimeRange}
                  onChange={(e) => setFeatureTimeRange(e.target.value)}
                  className="bg-white border text-sm border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Sort By:</span>
                 <select
                  value={featureSortBy}
                  onChange={(e) => setFeatureSortBy(e.target.value)}
                  className="bg-white border text-sm border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="most_used">Most Used</option>
                  <option value="least_used">Least Used</option>
                  <option value="recent">Most Recently Used</option>
                </select>
             </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg">
             <table className="w-full text-sm">
               <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium">Feature</th>
                    <th className="py-3 px-4 text-right font-medium">Times Used</th>
                    <th className="py-3 px-4 text-right font-medium">Last Used</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loadingModalData ? (
                     <tr><td colSpan={3} className="py-8 text-center text-slate-500">Loading features...</td></tr>
                  ) : allFeatureUsage.length === 0 ? (
                     <tr><td colSpan={3} className="py-8 text-center text-slate-500">No feature data for this period.</td></tr>
                  ) : (
                     [...allFeatureUsage].sort((a, b) => {
                       if (featureSortBy === 'most_used') return b.count - a.count;
                       if (featureSortBy === 'least_used') return a.count - b.count;
                       // recent
                       return new Date(b.last_used).getTime() - new Date(a.last_used).getTime();
                     }).map((feat, i) => (
                       <tr key={feat.name} className="hover:bg-slate-50">
                         <td className="py-3 px-4 font-medium text-slate-900 border-r border-slate-50">{feat.name}</td>
                         <td className="py-3 px-4 text-right border-r border-slate-50">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {feat.count.toLocaleString()}
                            </span>
                         </td>
                         <td className="py-3 px-4 text-right text-slate-500 text-xs">
                           {new Date(feat.last_used).toLocaleDateString()} {new Date(feat.last_used).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </td>
                       </tr>
                     ))
                  )}
               </tbody>
             </table>
          </div>
        </div>
      </Modal>

    </div>
  )
}

