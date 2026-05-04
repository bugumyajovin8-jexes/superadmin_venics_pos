import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card"
import { Input } from "@/src/components/ui/Input"
import { Button } from "@/src/components/ui/Button"
import { Badge } from "@/src/components/ui/Badge"
import { Modal } from "@/src/components/ui/Modal"
import { Search, ShieldBan, CalendarPlus, Filter, Loader2 } from "lucide-react"

interface Shop {
  id: string
  name: string
  owner_name: string | null
  phone: string | null
  status: string
  created_at: string
  licenses?: { id: string, expiry_date: string }[]
}

export function ShopsView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [selectedLicenseId, setSelectedLicenseId] = useState<string | null>(null)
  const [newExpiryDate, setNewExpiryDate] = useState("")

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shops')
      .select('*, licenses(id, expiry_date)')
      .order('created_at', { ascending: false })
    
    if (data) {
      setShops(data)
    } else if (error) {
      console.error("Error fetching shops:", error)
    }
    setLoading(false)
  }

  const filteredShops = shops.filter(shop => 
    shop.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggleBlock = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active'
    
    const { error } = await supabase
      .from('shops')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setShops(shops.map(shop => {
        if (shop.id === id) {
          return { ...shop, status: newStatus }
        }
        return shop
      }))
    } else {
      console.error("Error updating status:", error)
    }
  }

  const openExtendModal = (shop: Shop) => {
    setSelectedShopId(shop.id)
    const activeLicense = shop.licenses?.[0]
    setSelectedLicenseId(activeLicense?.id || null)
    // Format date for input type="date" (YYYY-MM-DD)
    const dateStr = activeLicense?.expiry_date ? new Date(activeLicense.expiry_date).toISOString().split('T')[0] : ""
    setNewExpiryDate(dateStr)
    setIsExtendModalOpen(true)
  }

  const updateLicenseDate = async (shopId: string, licenseId: string | null, isoDate: string) => {
    if (licenseId) {
      const { error } = await supabase
        .from('licenses')
        .update({ expiry_date: isoDate })
        .eq('id', licenseId)

      if (!error) {
        setShops(prevShops => prevShops.map(shop => {
          if (shop.id === shopId) {
            const updatedLicenses = shop.licenses?.length 
              ? shop.licenses.map(l => l.id === licenseId ? { ...l, expiry_date: isoDate } : l)
              : [{ id: licenseId, expiry_date: isoDate }]
            return { ...shop, licenses: updatedLicenses }
          }
          return shop
        }))
      } else {
        console.error("Error extending license:", error)
      }
    } else {
      // If no license exists, create one
      const { data, error } = await supabase
        .from('licenses')
        .insert([{ shop_id: shopId, expiry_date: isoDate, status: 'active' }])
        .select()
        
      if (!error && data) {
        setShops(prevShops => prevShops.map(shop => {
          if (shop.id === shopId) {
            return { ...shop, licenses: [data[0]] }
          }
          return shop
        }))
      } else {
        console.error("Error creating license:", error)
      }
    }
  }

  const handleExtendLicense = async () => {
    if (!selectedShopId || !newExpiryDate) return
    const isoDate = new Date(newExpiryDate).toISOString()
    await updateLicenseDate(selectedShopId, selectedLicenseId, isoDate)
    setIsExtendModalOpen(false)
  }

  const handleAdd30Days = async (shop: Shop) => {
    const activeLicense = shop.licenses?.[0]
    let baseDate = new Date()
    if (activeLicense?.expiry_date) {
      const expiry = new Date(activeLicense.expiry_date)
      // Only extend from existing expiry date if it hasn't expired yet
      if (expiry > baseDate) {
        baseDate = expiry
      }
    }
    baseDate.setDate(baseDate.getDate() + 30)
    await updateLicenseDate(shop.id, activeLicense?.id || null, baseDate.toISOString())
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Shop Management</h2>
          <p className="text-slate-500">Manage merchant accounts, licenses, and access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchShops}>
            Refresh Data
          </Button>
          <Button>Add New Shop</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Registered Merchants</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Search shops..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Shop ID / Name</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">License Expiry</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading shops from Supabase...
                      </div>
                    </td>
                  </tr>
                ) : filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No shops found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredShops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{shop.name}</div>
                        <div className="text-slate-500 text-xs font-mono">{shop.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{shop.owner_name || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={shop.status === 'active' ? 'success' : 'destructive'}>
                          {shop.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {shop.licenses?.[0]?.expiry_date ? new Date(shop.licenses[0].expiry_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1 text-xs px-2"
                            title="Add 30 Days Automatically"
                            onClick={() => handleAdd30Days(shop)}
                          >
                            +30d
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1 text-xs"
                            onClick={() => openExtendModal(shop)}
                          >
                            <CalendarPlus className="h-3 w-3" />
                            Extend
                          </Button>
                          <Button 
                            variant={shop.status === 'active' ? 'destructive' : 'default'} 
                            size="sm" 
                            className="h-8 gap-1 text-xs w-24"
                            onClick={() => handleToggleBlock(shop.id, shop.status)}
                          >
                            <ShieldBan className="h-3 w-3" />
                            {shop.status === 'active' ? 'Block' : 'Unblock'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal 
        isOpen={isExtendModalOpen} 
        onClose={() => setIsExtendModalOpen(false)}
        title="Extend Shop License"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">New Expiry Date</label>
            <Input 
              type="date" 
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsExtendModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendLicense}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
