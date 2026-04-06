import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { MetricCard } from "@/src/components/ui/MetricCard"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts"
import { deviceUsageData, retentionData } from "@/src/data/mockData"
import { Users, CreditCard, Clock, TrendingUp, Heart, MessageSquare } from "lucide-react"

const COLORS = ['#4f46e5', '#38bdf8', '#818cf8', '#c084fc'];

export function AnalyticsView() {
  const [topMerchants, setTopMerchants] = useState<any[]>([])
  const [peakSalesData, setPeakSalesData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true)
      try {
        // Fetch sales to calculate top merchants and peak times (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: sales } = await supabase
          .from('sales')
          .select('shop_id, total_amount, created_at, shops(name)')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .eq('status', 'completed')

        if (sales) {
          // 1. Process Top Merchants
          const shopTotals: Record<string, { name: string, sales: number }> = {}
          
          sales.forEach((sale: any) => {
            const shopName = Array.isArray(sale.shops) 
              ? sale.shops[0]?.name 
              : sale.shops?.name || 'Unknown Shop'
            
            if (!shopTotals[shopName]) {
              shopTotals[shopName] = { name: shopName, sales: 0 }
            }
            shopTotals[shopName].sales += (sale.total_amount || 0)
          })

          const sortedShops = Object.values(shopTotals)
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5) // Top 5

          setTopMerchants(sortedShops)

          // 2. Process Peak Sales Times (by hour of day)
          const hourlyData: Record<number, number> = {}
          for (let i = 0; i < 24; i++) hourlyData[i] = 0

          sales.forEach(sale => {
            const hour = new Date(sale.created_at).getHours()
            hourlyData[hour] += (sale.total_amount || 0)
          })

          const formattedPeakSales = Object.keys(hourlyData).map(hourStr => {
            const hour = parseInt(hourStr)
            const ampm = hour >= 12 ? 'pm' : 'am'
            const displayHour = hour % 12 || 12
            return {
              time: `${displayHour}${ampm}`,
              sales: hourlyData[hour]
            }
          })

          setPeakSalesData(formattedPeakSales)
        }
      } catch (error) {
        console.error("Error fetching analytics:", error)
      }
      setLoading(false)
    }

    fetchAnalytics()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics & Metrics</h2>
        <p className="text-slate-500">Deep dive into customer behavior, retention, and performance.</p>
      </div>

      {/* Behavior Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          title="Trial to Paid Conv."
          value="24.8%"
          icon={<TrendingUp className="h-4 w-4" />}
          trend={{ value: 2.1, label: "from last month", isPositive: true }}
        />
        <MetricCard
          title="Churn Rate (Monthly)"
          value="1.2%"
          icon={<Users className="h-4 w-4" />}
          trend={{ value: 0.3, label: "from last month", isPositive: false }}
        />
        <MetricCard
          title="Net Promoter Score (NPS)"
          value="72"
          icon={<Heart className="h-4 w-4" />}
          trend={{ value: 4, label: "from last quarter", isPositive: true }}
        />
        <MetricCard
          title="Open Support Tickets"
          value="18"
          icon={<MessageSquare className="h-4 w-4" />}
          trend={{ value: 12, label: "from yesterday", isPositive: false }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Merchants */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Merchants</CardTitle>
            <CardDescription>By total sales volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-slate-500">Loading data...</div>
              ) : topMerchants.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMerchants} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? val/1000 + 'k' : val}`} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} width={100} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Sales']}
                    />
                    <Bar dataKey="sales" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">No sales data found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Peak Sales Times */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Sales Times</CardTitle>
            <CardDescription>Total sales volume by hour of day (Last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-slate-500">Loading data...</div>
              ) : peakSalesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={peakSalesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? val/1000 + 'k' : val}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Sales']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">No sales data found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Device Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Device Usage</CardTitle>
            <CardDescription>Platform access by device type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceUsageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {deviceUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value}%`, 'Usage']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-900">100%</span>
                <span className="text-xs text-slate-500">Total Usage</span>
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              {deviceUsageData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm text-slate-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Retention Cohorts */}
        <Card>
          <CardHeader>
            <CardTitle>User Retention</CardTitle>
            <CardDescription>Percentage of users returning after initial signup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={retentionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value}%`, 'Retention Rate']}
                  />
                  <Line type="monotone" dataKey="rate" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
