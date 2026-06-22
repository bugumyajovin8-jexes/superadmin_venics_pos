import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { MetricCard } from "@/src/components/ui/MetricCard"
import { Modal } from "@/src/components/ui/Modal"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts"
import { systemHealthData } from "@/src/data/mockData"
import { Server, Activity, AlertOctagon, CheckCircle2, CloudLightning, Database, Wifi } from "lucide-react"

const COLORS = ['#4f46e5', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#fcd34d'];

export function SystemHealthView() {
  const [networkStats, setNetworkStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Shop specific stats modal
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [shopSpecificStats, setShopSpecificStats] = useState<any>(null);
  const [loadingShopStats, setLoadingShopStats] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/network')
      .then(res => res.json())
      .then(data => {
        setNetworkStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching network stats:", err);
        setLoading(false);
      });
  }, []);

  const handleShopClick = async (shop: any) => {
    setSelectedShop(shop);
    setIsModalOpen(true);
    setLoadingShopStats(true);
    setShopSpecificStats(null);
    try {
      const res = await fetch(`/api/analytics/network?shopId=${shop.shop_id}`);
      const data = await res.json();
      setShopSpecificStats(data);
    } catch (err) {
      console.error("Error fetching shop specific stats:", err);
    } finally {
      setLoadingShopStats(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const payloadDataForChart = (networkStats?.tableUsage || []).map((t: any) => ({
    name: `${t.table_name} (${t.sync_direction})`,
    value: t.total_bytes
  })).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Health & Network Analytics</h2>
        <p className="text-slate-500">Monitor API performance, uptime, data transfer (egress/ingress), and telemetry usage.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Status"
          value="Operational"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          className="border-emerald-200 bg-emerald-50/50"
        />
        <MetricCard
          title="Total Data Transferred"
          value={networkStats ? formatBytes(networkStats.tableUsage.reduce((acc: number, t: any) => acc + t.total_bytes, 0)) : "Loading"}
          icon={<CloudLightning className="h-4 w-4 text-indigo-500" />}
        />
        <MetricCard
          title="Average Payload"
          value={networkStats ? formatBytes(
            networkStats.payloadUsage.reduce((acc: number, t: any) => acc + t.avg_bytes_per_request, 0) / Math.max(1, networkStats.payloadUsage.length)
          ) : "Loading"}
          icon={<Wifi className="h-4 w-4 text-amber-500" />}
        />
        <MetricCard
          title="Active Synchronizations"
          value={networkStats ? networkStats.shopUsage.reduce((acc: number, s: any) => acc + s.total_requests, 0).toLocaleString() : "..."}
          icon={<Database className="h-4 w-4 text-purple-500" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Egress/Ingress Split per Table */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Transfer Volume by Table (Bytes)</CardTitle>
            <CardDescription>Egress/Ingress split identifying cost drivers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-slate-500">Loading network usage...</div>
            ) : networkStats?.tableUsage?.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payloadDataForChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {payloadDataForChart.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatBytes(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">No telemetry data found</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Data Volume by Shop</CardTitle>
            <CardDescription>Top data consumers (Ingress/Egress)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
              ) : networkStats?.shopUsage?.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 uppercase sticky top-0 border-b">
                    <tr>
                      <th className="px-4 py-3">Shop</th>
                      <th className="px-4 py-3 text-right text-emerald-600">Ingress</th>
                      <th className="px-4 py-3 text-right text-amber-600">Egress</th>
                      <th className="px-4 py-3 text-right text-indigo-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkStats.shopUsage.map((shop: any, idx: number) => (
                      <tr 
                        key={idx} 
                        className="border-b last:border-0 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                        onClick={() => handleShopClick(shop)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[120px]" title={shop.shop_name || shop.shop_id}>
                          {shop.shop_name || shop.shop_id}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600/80">{formatBytes(shop.ingress_bytes || 0)}</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-600/80">{formatBytes(shop.egress_bytes || 0)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatBytes(shop.est_total_bytes || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No shop usage data</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Average Request Payloads vs Volume per Table */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Payload Analysis per Table</CardTitle>
            <CardDescription>Pinpoint high-frequency small requests vs low-frequency heavy files</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="overflow-x-auto">
              {loading ? (
                 <div className="h-[200px] flex items-center justify-center text-slate-500">Loading...</div>
              ) : networkStats?.payloadUsage?.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                    <tr>
                      <th className="px-4 py-3">Table Name</th>
                      <th className="px-4 py-3 border-l text-center">Direction</th>
                      <th className="px-4 py-3 text-right">Avg Payload</th>
                      <th className="px-4 py-3 text-right">Max Payload</th>
                      <th className="px-4 py-3 text-right">Total Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkStats.payloadUsage.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.table_name}</td>
                        <td className="px-4 py-3 border-l text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${item.sync_direction === 'push' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.sync_direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 font-medium">{formatBytes(item.avg_bytes_per_request)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 font-medium">{formatBytes(item.max_bytes_per_request)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{item.total_requests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-400">No payload usage data</div>
              )}
             </div>
          </CardContent>
        </Card>

        {/* Keeping original charts as a reference layout */}
        <Card className="col-span-1 border-slate-100">
          <CardHeader className="opacity-50">
            <CardTitle>API Response Time (ms) - Mock</CardTitle>
          </CardHeader>
          <CardContent className="opacity-50">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={systemHealthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <Line type="monotone" dataKey="apiResponse" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Network Usage: ${selectedShop?.shop_name || selectedShop?.shop_id || 'Shop'}`}
        description="Detailed table and payload usage for this shop over the last 30 days."
        className="max-w-4xl max-h-[90vh] flex flex-col"
      >
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 -mx-6 -mb-6 mt-2 overflow-y-auto p-6 space-y-6">
          {loadingShopStats ? (
            <div className="flex items-center justify-center p-12 text-slate-500">Loading shop stats...</div>
          ) : shopSpecificStats ? (
            <>
              {/* Shop Total & Daily Graph */}
              <div className="mb-4">
                 <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-900">Total Monthly Data Transfer</h3>
                      <p className="text-xs text-indigo-700/70 mt-1">Sum of all synced payload estimates over the last 30 days</p>
                    </div>
                    <div className="text-2xl font-bold text-indigo-700">
                       {formatBytes(shopSpecificStats.dailyUsage?.reduce((acc: number, d: any) => acc + d.bytes, 0) || 0)}
                    </div>
                 </div>

                 <h3 className="text-sm font-semibold text-slate-900 mb-3">Daily Bandwidth Usage</h3>
                 <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm h-[240px]">
                    {shopSpecificStats.dailyUsage && shopSpecificStats.dailyUsage.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={shopSpecificStats.dailyUsage} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis 
                             dataKey="date" 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fill: '#64748b', fontSize: 12 }} 
                             dy={10} 
                             tickFormatter={(val) => {
                               const d = new Date(val);
                               return `${d.getDate()} / ${d.getMonth() + 1}`;
                             }}
                           />
                           <YAxis 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fill: '#64748b', fontSize: 12 }}
                             tickFormatter={(val) => {
                               if (val === 0) return '0';
                               const k = 1024;
                               const sizes = ['B', 'KB', 'MB', 'GB'];
                               const i = Math.floor(Math.log(val) / Math.log(k));
                               return parseFloat((val / Math.pow(k, i)).toFixed(0)) + ' ' + sizes[i];
                             }}
                           />
                           <Tooltip 
                             cursor={{ fill: '#f1f5f9' }}
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                             formatter={(value: number, name: string) => [formatBytes(value), name]}
                             labelFormatter={(label) => new Date(label).toLocaleDateString()}
                           />
                           <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                           <Bar dataKey="ingress_bytes" name="Ingress" stackId="a" fill="#34d399" maxBarSize={40} />
                           <Bar dataKey="egress_bytes" name="Egress" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={40} />
                         </BarChart>
                       </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">No daily usage data</div>
                    )}
                 </div>
              </div>

              {/* Shop Table Usage */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Sync Operations by Table</h3>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                        <tr>
                          <th className="px-4 py-3">Table Name</th>
                          <th className="px-4 py-3 border-l text-center">Direction</th>
                          <th className="px-4 py-3 text-right">Total Transferred</th>
                          <th className="px-4 py-3 text-right">Rows Transferred</th>
                          <th className="px-4 py-3 text-right">Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopSpecificStats.tableUsage?.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{item.table_name}</td>
                            <td className="px-4 py-3 border-l text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${item.sync_direction === 'push' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {item.sync_direction}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-indigo-600 font-medium">{formatBytes(item.total_bytes)}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{item.total_rows_transferred}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{item.event_count}</td>
                          </tr>
                        ))}
                        {(!shopSpecificStats.tableUsage || shopSpecificStats.tableUsage.length === 0) && (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No table usage data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Shop Payload Usage */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Payload Size Analysis</h3>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                        <tr>
                          <th className="px-4 py-3">Table Name</th>
                          <th className="px-4 py-3 border-l text-center">Direction</th>
                          <th className="px-4 py-3 text-right">Avg Payload</th>
                          <th className="px-4 py-3 text-right">Max Payload</th>
                          <th className="px-4 py-3 text-right">Total Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopSpecificStats.payloadUsage?.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{item.table_name}</td>
                            <td className="px-4 py-3 border-l text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${item.sync_direction === 'push' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {item.sync_direction}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600 font-medium">{formatBytes(item.avg_bytes_per_request)}</td>
                            <td className="px-4 py-3 text-right text-slate-600 font-medium">{formatBytes(item.max_bytes_per_request)}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{item.total_requests}</td>
                          </tr>
                        ))}
                        {(!shopSpecificStats.payloadUsage || shopSpecificStats.payloadUsage.length === 0) && (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No payload data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center p-12 text-slate-500 text-center">Failed to load shop specs.</div>
          )}
        </div>
      </Modal>
    </div>
  )
}

