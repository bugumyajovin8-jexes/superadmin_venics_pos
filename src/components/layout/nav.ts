import { LayoutDashboard, Store, BarChart3, Activity, Users, Megaphone, Package, Wallet, HeartPulse, Settings } from "lucide-react"

/**
 * Every page, in the order the menus show them (desktop sidebar and the phone's Menu).
 * Delete Account is deliberately not here: it opens only from Settings → Danger zone, behind a password.
 */
export const NAV_ITEMS = [
  { id: "dashboard", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { id: "shops", label: "Shop Management", short: "Shops", icon: Store },
  { id: "licences", label: "Licences & Payments", short: "Licences", icon: Wallet },
  { id: "shop-health", label: "Shop Health", short: "Health", icon: HeartPulse },
  { id: "directory", label: "Shop Directory", short: "Directory", icon: Users },
  { id: "products", label: "Shop Products", short: "Products", icon: Package },
  { id: "active", label: "Active Shops", short: "Active", icon: Activity },
  { id: "broadcast", label: "Broadcast", short: "Broadcast", icon: Megaphone },
  { id: "analytics", label: "Analytics & Metrics", short: "Analytics", icon: BarChart3 },
  { id: "health", label: "System Health", short: "System", icon: Activity },
] as const

export const SETTINGS_ITEM = { id: "settings", label: "Settings", short: "Settings", icon: Settings } as const

/** On a phone, the tabs at the bottom: what is used away from a desk. The rest is under "Menu". */
export const PHONE_TABS = ["dashboard", "licences", "shop-health", "shops"] as const
