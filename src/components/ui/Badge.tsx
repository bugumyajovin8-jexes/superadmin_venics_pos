import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
  className?: string
  children?: React.ReactNode
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
    secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
    destructive: "border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80",
    outline: "text-slate-950",
    success: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80",
    warning: "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100/80",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
