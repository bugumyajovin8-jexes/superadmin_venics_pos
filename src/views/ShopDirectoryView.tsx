import { useState, useEffect } from "react"
import { supabase, fetchAllRecords } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Badge } from "@/src/components/ui/Badge"
import { Users, User, Briefcase, Store, Loader2, Search, MessageSquare, AlertCircle, Calendar, Activity } from "lucide-react"
import { Input } from "@/src/components/ui/Input"
import { Button } from "@/src/components/ui/Button"
import { Modal } from "@/src/components/ui/Modal"

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

interface AssistantChat {
  id: string
  session_id: string
  message_type: 'user' | 'assistant' | 'system'
  content: string
  is_unresolved: boolean
  created_at: string
  metadata: any
}

export function ShopDirectoryView() {
  const [shops, setShops] = useState<ShopWithStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // AI Chats State
  const [isChatsModalOpen, setIsChatsModalOpen] = useState(false)
  const [selectedShopForChats, setSelectedShopForChats] = useState<ShopWithStaff | null>(null)
  const [shopChats, setShopChats] = useState<AssistantChat[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  // Feature Usage State
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false)
  const [selectedShopForUsage, setSelectedShopForUsage] = useState<ShopWithStaff | null>(null)
  const [shopUsage, setShopUsage] = useState<{name: string, count: number, lastUsed: string}[]>([])
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)

  useEffect(() => {
    fetchShopDirectory()
  }, [])

  const fetchShopDirectory = async () => {
    setLoading(true)
    try {
      // Fetch all shops
      const shopsQuery = supabase
        .from('shops')
        .select('id, name, status')
        .order('name')
      
      const shopsData = await fetchAllRecords(shopsQuery)

      // Fetch all users who belong to a shop
      const usersQuery = supabase
        .from('users')
        .select('id, name, email, role, phone, shop_id')
        .not('shop_id', 'is', null)

      const usersData = await fetchAllRecords(usersQuery)

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

  const handleOpenChats = async (shop: ShopWithStaff) => {
    setSelectedShopForChats(shop)
    setIsChatsModalOpen(true)
    setLoadingChats(true)
    setShopChats([])
    setChatError(null)

    try {
      const query = supabase
        .from('assistant_chats')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: true })
      
      const data = await fetchAllRecords(query)
      setShopChats(data || [])
    } catch (err: any) {
      console.error("Error fetching AI chats:", err)
      setChatError(err.message || "Failed to load chats")
    } finally {
      setLoadingChats(false)
    }
  }

  const handleOpenUsage = async (shop: ShopWithStaff) => {
    setSelectedShopForUsage(shop)
    setIsUsageModalOpen(true)
    setLoadingUsage(true)
    setShopUsage([])
    setUsageError(null)

    try {
      const query = supabase
        .from('saas_telemetry')
        .select('feature_key, created_at')
        .eq('shop_id', shop.id)
      
      const data = await fetchAllRecords(query)
      
      const TELEMETRY_LABELS: Record<string, string> = {
        pos_checkout: "Sales",
        mshauri_ai_advisor: "Chatbot",
        debt_payments_clearance: "Debts",
        expenses_tracker: "Expenses",
        bulk_product_import: "Excel",
        saas_feature_flag_toggle: "Features",
        product_expiry_tracker: "Expiry",
        camera_product_scan: "Camera AI",
        instant_product_message_share: "Quick product entrance",
        backdated_sale: "Backdate Sales",
        backdated_expense: "Backdate expenses",
        mabadiliko_ya_bidhaa: "Stock changes",
        employee_reports_view: "Employee reports",
        add_staff: "Add Employee",
        stock_valuation_checked: "Total Business Value",
        refund_sale: "Refund Sale",
        whatsapp_debt_reminder: "Whatsapp Debt"
      }

      const usageMap: Record<string, {count: number, lastUsed: string}> = {}

      ;(data || []).forEach(record => {
        const rawKey = record.feature_key
        const key = TELEMETRY_LABELS[rawKey] || rawKey
        if (!usageMap[key]) {
          usageMap[key] = { count: 0, lastUsed: record.created_at }
        }
        usageMap[key].count += 1
        if (new Date(record.created_at) > new Date(usageMap[key].lastUsed)) {
          usageMap[key].lastUsed = record.created_at
        }
      })

      const usageArray = Object.keys(usageMap).map(key => ({
        name: key,
        count: usageMap[key].count,
        lastUsed: usageMap[key].lastUsed
      })).sort((a, b) => b.count - a.count)

      setShopUsage(usageArray)
    } catch (err: any) {
      console.error("Error fetching feature usage:", err)
      setUsageError(err.message || "Failed to load feature usage")
    } finally {
      setLoadingUsage(false)
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

                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-end">
                   <Button 
                      variant="outline" 
                      className="w-full sm:w-auto gap-2 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                      onClick={() => handleOpenUsage(shop)}
                    >
                      <Activity className="h-4 w-4" />
                      View Feature Usage
                   </Button>
                   <Button 
                      variant="outline" 
                      className="w-full sm:w-auto gap-2 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                      onClick={() => handleOpenChats(shop)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      View Mshauri AI Chats
                   </Button>
                </div>
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

      {/* AI Chat History Modal */}
      <Modal 
        isOpen={isChatsModalOpen} 
        onClose={() => setIsChatsModalOpen(false)} 
        title={`AI Chat History: ${selectedShopForChats?.name}`}
        className="max-w-2xl w-full h-[80vh] flex flex-col"
      >
        <div className="flex-1 flex flex-col h-full bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
           {loadingChats ? (
             <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
               <Loader2 className="h-6 w-6 animate-spin" />
               Fetching chat history...
             </div>
           ) : chatError ? (
             <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-8 text-center gap-3">
               <AlertCircle className="h-12 w-12 text-red-200" />
               <div>Failed to load: {chatError}</div>
             </div>
           ) : shopChats.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center gap-3">
               <MessageSquare className="h-12 w-12 text-slate-300" />
               <div>No AI chat history found for this shop.</div>
             </div>
           ) : (
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {shopChats.map((chat) => {
                  const isUser = chat.message_type === 'user';
                  const isSystem = chat.message_type === 'system';
                  
                  if (isSystem) {
                    return (
                      <div key={chat.id} className="flex justify-center my-4">
                        <span className="bg-slate-200 text-slate-600 text-[10px] font-mono px-3 py-1 rounded-full flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(chat.created_at).toLocaleString()}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div key={chat.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 max-w-full`}>
                       <div className="flex items-end gap-2 max-w-[85%]">
                          {!isUser && (
                            <div className="h-8 w-8 min-w-[2rem] rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                               <MessageSquare className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl text-sm ${isUser ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm flex flex-col'}`}>
                             {chat.content}
                             {chat.is_unresolved && !isUser && (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-red-500 text-xs flex items-center gap-1 font-medium pb-0.5">
                                   <AlertCircle className="h-3 w-3" /> Flagged as Unresolved
                                </div>
                             )}
                          </div>
                       </div>
                       <div className={`text-[10px] text-slate-400 px-1 ${isUser ? 'pr-2' : 'pl-11'}`}>
                         {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         {chat.metadata?.intent && ` • Intent: ${chat.metadata.intent}`}
                       </div>
                    </div>
                  )
                })}
             </div>
           )}
        </div>
      </Modal>

      {/* Feature Usage Modal */}
      <Modal
        isOpen={isUsageModalOpen}
        onClose={() => setIsUsageModalOpen(false)}
        title={`Feature Usage: ${selectedShopForUsage?.name}`}
        description="Tracking feature adoption telemetry data for this shop."
        className="sm:max-w-[600px] h-[80vh] flex flex-col"
      >
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 -mx-6 -mb-6 mt-2 relative">
           {loadingUsage ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 p-8">
               <Loader2 className="h-6 w-6 animate-spin" />
               <span>Fetching telemetry data...</span>
             </div>
           ) : usageError ? (
             <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-8 text-center gap-3">
               <AlertCircle className="h-12 w-12 text-red-200" />
               <div>Failed to load: {usageError}</div>
             </div>
           ) : shopUsage.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center gap-3">
               <Activity className="h-12 w-12 text-slate-300" />
               <div>No telemetry tracking data found for this shop.</div>
             </div>
           ) : (
             <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {shopUsage.map((usage, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 bg-indigo-50 flex items-center justify-center rounded-lg text-indigo-600 font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{usage.name}</div>
                        <div className="text-xs text-slate-500">
                          Last used: {new Date(usage.lastUsed).toLocaleDateString()} at {new Date(usage.lastUsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold tracking-tight text-indigo-700">{usage.count}</div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Times Used</div>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </Modal>
    </div>
  )
}
