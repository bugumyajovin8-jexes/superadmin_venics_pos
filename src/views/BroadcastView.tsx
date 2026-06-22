import { useState, useEffect } from "react"
import { supabase, fetchAllRecords } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { Input } from "@/src/components/ui/Input"
import { Badge } from "@/src/components/ui/Badge"
import { Textarea } from "@/src/components/ui/Textarea"
import { Megaphone, Send, Users, Store, User, History, Loader2, CheckCircle2, Clock, AlertCircle, Search, X } from "lucide-react"

interface BroadcastMessage {
  id: string
  title: string
  body: string
  target_role: string
  status: string
  created_at: string
  sent_at: string | null
}

interface Shop {
  id: string
  name: string
}

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  shop_id: string | null
}

export function BroadcastView() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [targetType, setTargetType] = useState<"all" | "role" | "shops" | "users">("all")
  const [targetRole, setTargetRole] = useState<"boss" | "employee">("boss")
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  
  const [shops, setShops] = useState<Shop[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [history, setHistory] = useState<BroadcastMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  
  const [shopSearch, setShopSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const shopsQuery = supabase.from('shops').select('id, name').order('name')
      const usersQuery = supabase.from('users').select('id, name, email, role, shop_id').order('name')
      const historyQuery = supabase.from('broadcast_messages').select('*').order('created_at', { ascending: false }).limit(10)

      const [shopsData, usersData, historyData] = await Promise.all([
        fetchAllRecords(shopsQuery),
        fetchAllRecords(usersQuery),
        fetchAllRecords(historyQuery)
      ])

      if (shopsData) setShops(shopsData)
      if (usersData) setUsers(usersData)
      if (historyData) setHistory(historyData)
    } catch (error) {
      console.error("Error fetching broadcast data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!title || !body) return
    
    setSending(true)
    try {
      let finalTargetRole = targetType === 'all' ? 'all' : (targetType === 'role' ? targetRole : targetType)
      let targetIds: string[] | null = null
      
      if (targetType === 'shops') {
        targetIds = selectedShopIds
      } else if (targetType === 'users') {
        targetIds = selectedUserIds
      }
      
      const { data, error } = await supabase
        .from('broadcast_messages')
        .insert([{
          title,
          body,
          target_role: finalTargetRole,
          target_ids: targetIds,
          status: 'pending'
        }])
        .select()

      if (error) throw error

      // Reset form
      setTitle("")
      setBody("")
      setTargetType("all")
      setSelectedShopIds([])
      setSelectedUserIds([])
      
      // Refresh history
      if (data) {
        setHistory([data[0], ...history])
      }
      
      alert("Message queued for broadcast!")
    } catch (error) {
      console.error("Error sending broadcast:", error)
      alert("Failed to queue message. Make sure the 'broadcast_messages' table is correctly set up.")
    } finally {
      setSending(false)
    }
  }

  const toggleShop = (id: string) => {
    setSelectedShopIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleUser = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const filteredShops = shops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase()))
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Broadcast Messages</h2>
          <p className="text-slate-500">Send push notifications to POS users via FCM.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Composer */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-indigo-600" />
              Compose Message
            </CardTitle>
            <CardDescription>Create a new notification for your users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Message Title</label>
                <Input 
                  placeholder="e.g., System Maintenance" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Message Body</label>
                <Textarea 
                  placeholder="Enter your message here..." 
                  className="min-h-[120px]"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <label className="text-sm font-medium text-slate-700">Target Audience</label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={targetType === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTargetType('all')}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" /> All Users
                </Button>
                <Button 
                  variant={targetType === 'role' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTargetType('role')}
                  className="gap-2"
                >
                  <User className="h-4 w-4" /> By Role
                </Button>
                <Button 
                  variant={targetType === 'shops' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTargetType('shops')}
                  className="gap-2"
                >
                  <Store className="h-4 w-4" /> Selected Shops
                </Button>
                <Button 
                  variant={targetType === 'users' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTargetType('users')}
                  className="gap-2"
                >
                  <User className="h-4 w-4" /> Selected Users
                </Button>
              </div>

              {/* Target: Role */}
              {targetType === 'role' && (
                <div className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="role" 
                      checked={targetRole === 'boss'} 
                      onChange={() => setTargetRole('boss')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Bosses Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="role" 
                      checked={targetRole === 'employee'} 
                      onChange={() => setTargetRole('employee')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Employees Only</span>
                  </label>
                </div>
              )}

              {/* Target: Shops */}
              {targetType === 'shops' && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search shops..." 
                      className="pl-9 h-9 text-sm"
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {filteredShops.map(shop => (
                      <label key={shop.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedShopIds.includes(shop.id)}
                          onChange={() => toggleShop(shop.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{shop.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-200">
                    {selectedShopIds.length > 0 ? (
                      selectedShopIds.map(id => {
                        const shop = shops.find(s => s.id === id)
                        return (
                          <span key={id}>
                            <Badge variant="secondary" className="gap-1">
                              {shop?.name}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleShop(id)} />
                            </Badge>
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-xs text-slate-400 italic">No shops selected</span>
                    )}
                  </div>
                </div>
              )}

              {/* Target: Users */}
              {targetType === 'users' && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-9 h-9 text-sm"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {filteredUsers.map(user => (
                      <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{user.name}</span>
                          <span className="text-[10px] text-slate-500">{user.email} • {user.role}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-200">
                    {selectedUserIds.length > 0 ? (
                      selectedUserIds.map(id => {
                        const user = users.find(u => u.id === id)
                        return (
                          <span key={id}>
                            <Badge variant="secondary" className="gap-1">
                              {user?.name}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleUser(id)} />
                            </Badge>
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-xs text-slate-400 italic">No users selected</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSend} 
                disabled={sending || !title || !body}
                className="gap-2 w-full sm:w-auto"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Queue Broadcast
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-slate-500" />
              Recent History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  No broadcast history found.
                </div>
              ) : (
                history.map(msg => (
                  <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-slate-900 text-sm truncate pr-2">{msg.title}</h4>
                      <Badge 
                        variant={msg.status === 'sent' ? 'success' : (msg.status === 'failed' ? 'destructive' : 'warning')}
                        className="text-[10px] h-5 px-1.5"
                      >
                        {msg.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{msg.body}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {msg.target_role.toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(msg.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
