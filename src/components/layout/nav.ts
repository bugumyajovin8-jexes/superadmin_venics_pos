import { LayoutDashboard, Store, BarChart3, Megaphone, Package, Wallet, HeartPulse, Settings, UserX } from "lucide-react"

/**
 * Every page, in the order the menus show them (desktop sidebar and the phone's Menu).
 * Removed on 18 Nov 2026 (their files are in removed-pages/, outside src):
 *   Active Shops (Overview shows the same from the daily totals, without
 *   downloading every sale made today), Shop Directory (merged into Shops and
 *   Shop Health), Analytics & Metrics + System Health (now App Usage).
 * Delete Account is deliberately not here: it opens only from Settings → Danger zone, behind a password.
 */
export const NAV_ITEMS = [
  { id: "dashboard", label: "Overview", short: "Overview", icon: LayoutDashboard },
  // Was Shop Management and Shop Directory: one list, with each shop's people.
  { id: "shops", label: "Shops", short: "Shops", icon: Store },
  { id: "licences", label: "Licences & Payments", short: "Licences", icon: Wallet },
  // One shop in full, now with its AI chats and the features it uses.
  { id: "shop-health", label: "Shop Health", short: "Health", icon: HeartPulse },
  { id: "mistaken", label: "Mistaken Shops", short: "Mistaken", icon: UserX },
  { id: "products", label: "Shop Products", short: "Products", icon: Package },
  { id: "broadcast", label: "Broadcast", short: "Broadcast", icon: Megaphone },
  // Was Analytics & Metrics and System Health.
  { id: "usage", label: "App Usage", short: "Usage", icon: BarChart3 },
] as const

export const SETTINGS_ITEM = { id: "settings", label: "Settings", short: "Settings", icon: Settings } as const

/** On a phone, the tabs at the bottom: what is used away from a desk. The rest is under "Menu". */
export const PHONE_TABS = ["dashboard", "licences", "shop-health", "shops"] as const
