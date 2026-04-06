import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { MetricCard } from "@/src/components/ui/MetricCard"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { systemHealthData } from "@/src/data/mockData"
import { Server, Activity, AlertOctagon, CheckCircle2 } from "lucide-react"

export function SystemHealthView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Health</h2>
        <p className="text-slate-500">Monitor API performance, uptime, and system errors.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Status"
          value="Operational"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          className="border-emerald-200 bg-emerald-50/50"
        />
        <MetricCard
          title="Avg API Latency"
          value="145ms"
          icon={<Activity className="h-4 w-4" />}
          trend={{ value: 12, label: "from yesterday", isPositive: false }}
        />
        <MetricCard
          title="Error Rate"
          value="0.02%"
          icon={<AlertOctagon className="h-4 w-4" />}
          trend={{ value: 0.01, label: "from yesterday", isPositive: true }}
        />
        <MetricCard
          title="Active Nodes"
          value="24/24"
          icon={<Server className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* API Response Time */}
        <Card>
          <CardHeader>
            <CardTitle>API Response Time (ms)</CardTitle>
            <CardDescription>Average latency over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={systemHealthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value}ms`, 'Latency']}
                  />
                  <Line type="monotone" dataKey="apiResponse" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Error Count */}
        <Card>
          <CardHeader>
            <CardTitle>System Errors</CardTitle>
            <CardDescription>Failed transactions and crashes over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={systemHealthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [value, 'Errors']}
                  />
                  <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
