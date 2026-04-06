import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { MetricCard } from "@/src/components/ui/MetricCard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { DollarSign, Users, Store, Activity, AlertTriangle, Info, XCircle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { alertsData } from "@/src/data/mockData"

export function DashboardView() {
  const [metrics, setMetrics] = useState({
    activeMerchants: 0,
    totalRevenue: 0,
    dau: 0,
  })
  const [mrrChartData, setMrrChartData] = useState<any[]>([])

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Active Merchants
        const { count: activeMerchants } = await supabase
          .from('shops')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')

        // Revenue (Sum of sales total_amount for current month)
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        const { data: sales } = await supabase
          .from('sales')
          .select('total_amount')
          .gte('created_at', startOfMonth.toISOString())
          .eq('status', 'completed')

        const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0

        // DAU (Users active today via sales)
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        
        const { data: activeSales } = await supabase
          .from('sales')
          .select('user_id')
          .gte('created_at', startOfDay.toISOString())

        const uniqueUsers = new Set(activeSales?.map(s => s.user_id).filter(Boolean))
        const dau = uniqueUsers.size

        setMetrics({
          activeMerchants: activeMerchants || 0,
          totalRevenue,
          dau: dau
        })

        // Fetch Historical Sales for MRR Chart (Last 6 Months)
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
        sixMonthsAgo.setDate(1)
        sixMonthsAgo.setHours(0, 0, 0, 0)

        const { data: historicalSales } = await supabase
          .from('sales')
          .select('total_amount, created_at')
          .gte('created_at', sixMonthsAgo.toISOString())
          .eq('status', 'completed')

        if (historicalSales) {
          const monthlyData: Record<string, number> = {}
          
          // Initialize last 6 months with 0 to ensure they appear on the chart
          for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const monthName = d.toLocaleString('default', { month: 'short' })
            monthlyData[monthName] = 0
          }

          historicalSales.forEach(sale => {
            const date = new Date(sale.created_at)
            const monthName = date.toLocaleString('default', { month: 'short' })
            if (monthlyData[monthName] !== undefined) {
              monthlyData[monthName] += (sale.total_amount || 0)
            }
          })

          const formattedChartData = Object.keys(monthlyData).map(month => ({
            name: month,
            mrr: monthlyData[month],
            target: monthlyData[month] > 0 ? monthlyData[month] * 1.15 : 5000 // Fake target for visual reference
          }))
          
          setMrrChartData(formattedChartData)
        }

      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      }
    }
    
    fetchDashboardData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Revenue (This Month)"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Merchants"
          value={metrics.activeMerchants.toLocaleString()}
          icon={<Store className="h-4 w-4" />}
        />
        <MetricCard
          title="Daily Active Users"
          value={metrics.dau.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="System Uptime"
          value="99.99%"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Main Chart */}
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Revenue Growth (MRR)</CardTitle>
            <CardDescription>Monthly recurring revenue compared to targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {mrrChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mrrChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(value) => `$${value >= 1000 ? value/1000 + 'k' : value}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']}
                    />
                    <Area type="monotone" dataKey="mrr" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorMrr)" />
                    <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">Loading chart data...</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts Widget */}
        <Card className="md:col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Alerts & Insights</CardTitle>
            <CardDescription>Recent system notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alertsData.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 shadow-sm">
                  <div className="mt-0.5">
                    {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {alert.type === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                    {alert.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-slate-700 leading-tight">{alert.message}</p>
                    <span className="text-xs text-slate-400">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
