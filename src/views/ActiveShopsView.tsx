import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Badge } from "@/src/components/ui/Badge"
import { Store, Loader2, Activity, DollarSign, ExternalLink } from "lucide-react"

interface ActiveShop {
  id: string
  name: string
  owner_name: string | null
  total_sales_today: number
  total_revenue_today: number
  last_sale_time: string | null
}

export function ActiveShopsView() {
  const [activeShops, setActiveShops] = useState<ActiveShop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActiveShops()
  }, [])

  const fetchActiveShops = async () => {
    setLoading(true)
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      // Fetch today's sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('shop_id, total_amount, created_at, shops(id, name, owner_name)')
        .gte('created_at', startOfDay.toISOString())

      if (salesError) throw salesError

      if (sales) {
        // Aggregate sales data per shop
        const shopStats: Record<string, ActiveShop> = {}

        sales.forEach((sale: any) => {
          const shopId = sale.shop_id
          if (!shopId) return
          
          const shopName = Array.isArray(sale.shops) ? sale.shops[0]?.name : sale.shops?.name || 'Unknown Shop'
          const ownerName = Array.isArray(sale.shops) ? sale.shops[0]?.owner_name : sale.shops?.owner_name || 'N/A'

          if (!shopStats[shopId]) {
            shopStats[shopId] = {
              id: shopId,
              name: shopName,
              owner_name: ownerName,
              total_sales_today: 0,
              total_revenue_today: 0,
              last_sale_time: sale.created_at
            }
          }

          shopStats[shopId].total_sales_today += 1
          shopStats[shopId].total_revenue_today += (sale.total_amount || 0)
          
          // Update last sale time if this sale is newer
          if (new Date(sale.created_at) > new Date(shopStats[shopId].last_sale_time as string)) {
            shopStats[shopId].last_sale_time = sale.created_at
          }
        })

        // Convert to array and sort by revenue
        const sortedShops = Object.values(shopStats).sort((a, b) => b.total_revenue_today - a.total_revenue_today)
        setActiveShops(sortedShops)
      }
    } catch (err) {
      console.error("Error fetching active shops:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'N/A'
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            Active Shops
          </h2>
          <p className="text-slate-500">Shops that have successfully recorded sales today.</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-indigo-900 font-medium">
            {activeShops.length} Online Now
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Today's Activity Board</CardTitle>
          <CardDescription>Live stats for currently active merchants.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Shop Details</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium text-right">Transactions</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue Today</th>
                  <th className="px-4 py-3 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Scanning for active shops...
                      </div>
                    </td>
                  </tr>
                ) : activeShops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      <Store className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p>No shops are active yet today.</p>
                      <p className="text-xs mt-1">Sales recorded today will appear here automatically.</p>
                    </td>
                  </tr>
                ) : (
                  activeShops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                            {shop.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{shop.name}</div>
                            <div className="text-slate-400 text-xs font-mono">{shop.id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{shop.owner_name}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="secondary" className="font-mono">
                          {shop.total_sales_today} items
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-emerald-600 flex items-center justify-end gap-1">
                          <DollarSign className="h-3 w-3" />
                          {shop.total_revenue_today.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {formatTime(shop.last_sale_time)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
