import { Search } from "lucide-react"
import { ShopHealthPanel } from "@/src/components/ShopHealthPanel"

/**
 * For when a boss calls: the search bar at the top finds their shop (by name,
 * owner, or the number calling) and opens its health here.
 */
export function ShopHealthView({ initialShopId }: { initialShopId?: string | null }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Shop Health</h2>
        <p className="text-slate-500">When a boss calls: find their shop, then see its licence, devices, what is stuck, and what reached the server.</p>
      </div>

      {initialShopId
        ? <ShopHealthPanel shopId={initialShopId} />
        : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600" data-testid="health-empty">
            <Search className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p>
              Type in the <strong>search bar at the top</strong>: the shop's name, the owner's name, or the
              phone number that is calling (e.g. 0712 345 678). Choose the shop to see its health.
              Shop Management also has a <strong>Health</strong> button for every shop.
            </p>
          </div>
        )}
    </div>
  )
}
