import { useState, useEffect } from "react"
import { supabase } from "@/src/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/Card"
import { Button } from "@/src/components/ui/Button"
import { Input } from "@/src/components/ui/Input"
import { Badge } from "@/src/components/ui/Badge"
import { Store, Loader2, Download, Search, ChevronRight, ArrowLeft, Package, Plus, Save, X, Edit2 } from "lucide-react"
import * as XLSX from "xlsx"

interface Shop {
  id: string
  name: string
  owner_name: string | null
}

interface Product {
  id: string
  name: string
  buy_price: number
  sell_price: number
  stock: number
  unit: string
}

export function ShopProductsView() {
  const [shops, setShops] = useState<Shop[]>([])
  const [filteredShops, setFilteredShops] = useState<Shop[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loadingShops, setLoadingShops] = useState(true)
  
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Product>>({})
  const [savingProductId, setSavingProductId] = useState<string | null>(null)

  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [newProductForm, setNewProductForm] = useState<Partial<Product>>({ unit: 'pcs', buy_price: 0, sell_price: 0, stock: 0, name: '' })
  const [isSavingNewProduct, setIsSavingNewProduct] = useState(false)

  useEffect(() => {
    fetchShops()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredShops(shops)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredShops(
        shops.filter(
          (shop) =>
            shop.name?.toLowerCase().includes(query) ||
            shop.owner_name?.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, shops])

  const fetchShops = async () => {
    setLoadingShops(true)
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id, name, owner_name')
        .order('name')
        
      if (error) throw error
      if (data) {
        setShops(data)
        setFilteredShops(data)
      }
    } catch (error) {
      console.error("Error fetching shops:", error)
    } finally {
      setLoadingShops(false)
    }
  }

  const fetchProducts = async (shopId: string) => {
    setLoadingProducts(true)
    try {
      const response = await fetch(`/api/shops/${shopId}/products`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch products')
      }
      const data = await response.json()
      setProducts(data)
    } catch (error: any) {
      console.error("Error fetching products:", error)
      alert("Failed to load products: " + error.message)
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleSelectShop = async (shop: Shop) => {
    setSelectedShop(shop)
    setEditingProductId(null)
    setIsAddingProduct(false)
    fetchProducts(shop.id)
  }

  const handleBack = () => {
    setSelectedShop(null)
    setProducts([])
    setEditingProductId(null)
    setIsAddingProduct(false)
  }

  const handleStartEdit = (product: Product) => {
    setEditingProductId(product.id)
    setEditForm(product)
  }

  const handleCancelEdit = () => {
    setEditingProductId(null)
    setEditForm({})
  }

  const handleSaveEdit = async () => {
    if (!editingProductId || !selectedShop) return
    
    setSavingProductId(editingProductId)
    try {
      const response = await fetch(`/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update product')
      }
      
      const updatedProduct = await response.json()
      setProducts(products.map(p => p.id === editingProductId ? updatedProduct : p))
      setEditingProductId(null)
    } catch (error: any) {
      console.error("Error saving product:", error)
      alert("Failed to save product: " + error.message)
    } finally {
      setSavingProductId(null)
    }
  }

  const handleCreateProduct = async () => {
    if (!selectedShop) return
    if (!newProductForm.name) {
      alert("Product name is required")
      return
    }

    setIsSavingNewProduct(true)
    try {
      const response = await fetch(`/api/shops/${selectedShop.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProductForm),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create product')
      }
      
      const newProduct = await response.json()
      setProducts([newProduct, ...products].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setIsAddingProduct(false)
      setNewProductForm({ unit: 'pcs', buy_price: 0, sell_price: 0, stock: 0, name: '' })
    } catch (error: any) {
      console.error("Error creating product:", error)
      alert("Failed to create product: " + error.message)
    } finally {
      setIsSavingNewProduct(false)
    }
  }

  const handleExportExcel = () => {
    if (!products || products.length === 0) return

    const formattedData = products.map(p => ({
      'Product Name': p.name,
      'Cost Price': p.buy_price,
      'Selling Price': p.sell_price,
      'Stock': p.stock,
      'Unit': p.unit || 'pcs'
    }))

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products")

    const fileName = `${selectedShop?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_products_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  if (selectedShop) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={handleBack} className="h-8 px-2 gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Shops
              </Button>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Store className="h-6 w-6 text-indigo-600" />
              {selectedShop.name}
            </h2>
            <p className="text-slate-500">Showing all active products for this shop.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isAddingProduct && (
              <Button
                onClick={() => setIsAddingProduct(true)}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            )}
            <Button
              onClick={handleExportExcel}
              disabled={products.length === 0 || loadingProducts}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Product Inventory</CardTitle>
            <CardDescription>{products.length} products found.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product Name</th>
                    <th className="px-4 py-3 font-medium text-right">Cost Price</th>
                    <th className="px-4 py-3 font-medium text-right">Selling Price</th>
                    <th className="px-4 py-3 font-medium text-right">Stock</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isAddingProduct && (
                    <tr className="bg-indigo-50/50">
                      <td className="px-4 py-2">
                        <Input 
                          size={1}
                          className="h-8 text-sm" 
                          placeholder="Product name" 
                          autoFocus
                          value={newProductForm.name || ''} 
                          onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          type="number" 
                          className="h-8 text-sm text-right" 
                          value={newProductForm.buy_price === 0 ? '' : newProductForm.buy_price} 
                          onChange={e => setNewProductForm({...newProductForm, buy_price: parseFloat(e.target.value) || 0})} 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          type="number" 
                          className="h-8 text-sm text-right" 
                          value={newProductForm.sell_price === 0 ? '' : newProductForm.sell_price} 
                          onChange={e => setNewProductForm({...newProductForm, sell_price: parseFloat(e.target.value) || 0})} 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          type="number" 
                          className="h-8 text-sm text-right" 
                          value={newProductForm.stock === 0 ? '' : newProductForm.stock} 
                          onChange={e => setNewProductForm({...newProductForm, stock: parseFloat(e.target.value) || 0})} 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          className="h-8 text-sm" 
                          placeholder="pcs" 
                          value={newProductForm.unit || ''} 
                          onChange={e => setNewProductForm({...newProductForm, unit: e.target.value})} 
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500" onClick={() => setIsAddingProduct(false)} title="Cancel">
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="h-8 w-8 p-0 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateProduct} disabled={isSavingNewProduct} title="Save">
                            {isSavingNewProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {loadingProducts && !isAddingProduct ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex justify-center items-center gap-2 text-slate-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading products...
                        </div>
                      </td>
                    </tr>
                  ) : products.length === 0 && !isAddingProduct ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p>No products found for this shop.</p>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const isEditing = editingProductId === product.id
                      const isSaving = savingProductId === product.id

                      return (
                        <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input 
                                className="h-8 text-sm min-w-[150px]" 
                                value={editForm.name || ''} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                              />
                            ) : (
                              <div className="font-medium text-slate-900">{product.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input 
                                type="number" 
                                className="h-8 text-sm text-right w-[100px] ml-auto" 
                                value={editForm.buy_price ?? ''} 
                                onChange={e => setEditForm({...editForm, buy_price: parseFloat(e.target.value) || 0})} 
                              />
                            ) : (
                              <div className="tabular-nums text-slate-500">{product.buy_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input 
                                type="number" 
                                className="h-8 text-sm text-right w-[100px] ml-auto" 
                                value={editForm.sell_price ?? ''} 
                                onChange={e => setEditForm({...editForm, sell_price: parseFloat(e.target.value) || 0})} 
                              />
                            ) : (
                              <div className="tabular-nums text-slate-900 font-medium">{product.sell_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input 
                                type="number" 
                                className="h-8 text-sm text-right w-[80px] ml-auto" 
                                value={editForm.stock ?? ''} 
                                onChange={e => setEditForm({...editForm, stock: parseFloat(e.target.value) || 0})} 
                              />
                            ) : (
                              <Badge variant={product.stock <= 0 ? 'destructive' : 'secondary'} className="tabular-nums">
                                {product.stock}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                             {isEditing ? (
                               <Input 
                                 className="h-8 text-sm w-[60px]" 
                                 value={editForm.unit || ''} 
                                 onChange={e => setEditForm({...editForm, unit: e.target.value})} 
                               />
                             ) : (
                               <div className="text-slate-500">{product.unit || 'pcs'}</div>
                             )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCancelEdit} title="Cancel">
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" className="h-8 w-8 p-0 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSaveEdit} disabled={isSaving} title="Save">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600" onClick={() => handleStartEdit(product)} title="Edit">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" />
            Shop Products
          </h2>
          <p className="text-slate-500">Select a shop to view its product inventory and export data.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <CardTitle>Select a Shop</CardTitle>
              <CardDescription>Choose a shop from the list to view its products.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search shops..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {loadingShops ? (
              <div className="p-8 text-center text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading shops...
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No shops found matching your search.
              </div>
            ) : (
              filteredShops.map((shop) => (
                <div 
                  key={shop.id} 
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
                  onClick={() => handleSelectShop(shop)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      {shop.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{shop.name}</h4>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        Owner: {shop.owner_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
