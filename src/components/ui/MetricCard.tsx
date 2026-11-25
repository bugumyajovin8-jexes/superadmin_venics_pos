import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
    isPositive: boolean
  }
  className?: string
}

export function MetricCard({ title, value, icon, trend, className }: MetricCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {title}
        </CardTitle>
        {icon && <div className="text-slate-400">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {trend && (
          <p className="mt-1 flex items-center text-xs">
            <span
              className={cn(
                "flex items-center font-medium",
                trend.isPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? (
                <ArrowUpIcon className="mr-1 h-3 w-3" />
              ) : (
                <ArrowDownIcon className="mr-1 h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </span>
            <span className="ml-1 text-slate-500">{trend.label}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
