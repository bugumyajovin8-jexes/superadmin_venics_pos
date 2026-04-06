import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Badge } from "@/src/components/ui/Badge"
import { Users, User, Briefcase, Store, Loader2, Search } from "lucide-react"
import { Input } from "@/src/components/ui/Input"

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
}

interface ShopWithStaff {
  id: string
  name: string
  status: string
  users: UserProfile[]
}

export function ShopDirectoryView() {
  const [shops, setShops] = useState<ShopWithStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchShopDirectory()
  }, [])

  const fetchShopDirectory = async () => {
    setLoading(true)
    try {
      // Fetch all shops
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('id, name, status')
        .order('name')

      if (shopsError) throw shopsError

      // Fetch all users who belong to a shop
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role, phone, shop_id')
        .not('shop_id', 'is', null)

      if (usersError) throw usersError

      // Map users to their respective shops
      const combinedData = (shopsData || []).map(shop => ({
        ...shop,
        users: (usersData || []).filter(user => user.shop_id === shop.id)
      }))

      setShops(combinedData as ShopWithStaff[])
    } catch (err) {
      console.error("Error fetching shop directory:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredShops = shops.filter(shop => 
    shop.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading shop directory...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Shop Directory</h2>
          <p className="text-slate-500">Detailed overview of shops and their staff hierarchy.</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Total Shops</div>
          <div className="text-2xl font-bold text-indigo-900">{shops.length}</div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="Search shops by name or ID..." 
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredShops.map((shop) => {
          const boss = shop.users?.find(u => u.role === 'boss')
          const employees = shop.users?.filter(u => u.role === 'employee') || []
          const otherStaff = shop.users?.filter(u => u.role !== 'boss' && u.role !== 'employee') || []

          return (
            <Card key={shop.id} className="overflow-hidden border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <Store className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{shop.name}</CardTitle>
                      <CardDescription className="font-mono text-[10px]">{shop.id}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={shop.status === 'active' ? 'success' : 'destructive'}>
                    {shop.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Boss Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Briefcase className="h-3 w-3" />
                    Shop Boss
                  </div>
                  {boss ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/50">
                      <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                        {boss.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{boss.name}</div>
                        <div className="text-xs text-slate-500">{boss.email}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 italic px-3">No boss assigned</div>
                  )}
                </div>

                {/* Employees Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <Users className="h-3 w-3" />
                      Employees
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {employees.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {employees.length > 0 ? (
                      employees.map(emp => (
                        <div key={emp.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-medium">
                            {emp.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate">{emp.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{emp.email}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-400 italic px-3">No employees found</div>
                    )}
                  </div>
                </div>

                {/* Other Staff Section (Optional) */}
                {otherStaff.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Other Roles</div>
                    <div className="flex flex-wrap gap-1">
                      {otherStaff.map(staff => (
                        <span key={staff.id}>
                          <Badge variant="outline" className="text-[10px] py-0 px-2">
                            {staff.name} ({staff.role})
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredShops.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <Store className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No shops found</h3>
          <p className="text-slate-500">Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  )
}
