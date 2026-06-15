import React, { useState, useRef } from "react"
import { Button } from "@/src/components/ui/Button"
import { Loader2, Upload, AlertCircle, CheckCircle2, Download, Table2, X, Sparkles } from "lucide-react"
import * as XLSX from "xlsx"
import Fuse from "fuse.js"
import { Badge } from "@/src/components/ui/Badge"

interface Product {
  id: string
  name: string
  buy_price: number
  sell_price: number
  stock: number
  unit: string
}

interface SmartExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  currentProducts: Product[]
  shopId: string
  onProductsUpdated: () => void
}

interface FlowAMatch {
  originalProduct: Product
  matchedName: string
  newBuyPrice: number
  newSellPrice: number
}

interface FlowBNewProduct {
  name: string
  buyPrice: number
  sellPrice: number
  [key: string]: any
}

export function SmartExcelImportModal({ isOpen, onClose, currentProducts, shopId, onProductsUpdated }: SmartExcelImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAiMatching, setIsAiMatching] = useState(false)
  
  const [flowAMatches, setFlowAMatches] = useState<FlowAMatch[]>([])
  const [flowBNewProducts, setFlowBNewProducts] = useState<FlowBNewProduct[]>([])
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setStep('upload')
    setFlowAMatches([])
    setFlowBNewProducts([])
    setActiveTab('A')
    setIsProcessing(false)
    setIsUpdating(false)
    setIsAiMatching(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const parseNumber = (val: any) => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/,/g, ''))
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet)

      if (!rows || rows.length === 0) {
        alert("The uploaded Excel file appears to be empty.")
        resetState()
        return
      }

      // Prepare Fuse.js for finding matches.
      // We search against the CURRENT products in our DB.
      const fuse = new Fuse(currentProducts, {
        keys: ['name'],
        includeScore: true,
        threshold: 0.4, // lower threshold means stricter match requirement
        ignoreLocation: true,
      })

      // Helper for token-based match (word overlap and arrangement independence)
      const getWordOverlapScore = (str1: string, str2: string) => {
        const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
        const tokens1 = tokenize(str1);
        const tokens2 = tokenize(str2);
        
        if (!tokens1.length || !tokens2.length) return 0;
        
        const set1 = new Set(tokens1);
        const set2 = new Set(tokens2);
        const intersection = [...set1].filter(x => set2.has(x));
        
        const minSize = Math.min(set1.size, set2.size);
        const maxSize = Math.max(set1.size, set2.size);
        
        if (minSize === 0) return 0;
        
        const matchRatio = intersection.length / minSize; 
        const lengthRatio = minSize / maxSize;
        
        return (matchRatio * 0.75) + (lengthRatio * 0.25); // 1.0 is perfect match
      }

      const newFlowAMatches: FlowAMatch[] = []
      const newFlowBProducts: FlowBNewProduct[] = []
      
      const zeroPriceProducts = currentProducts.filter(p => Number(p.buy_price) === 0 && Number(p.sell_price) === 0)

      rows.forEach(row => {
        // Try to identify the product name and prices from the Excel row flexibly
        const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('product')) || Object.keys(row)[0]
        const buyPriceKey = Object.keys(row).find(k => k.toLowerCase().includes('cost') || k.toLowerCase().includes('buy'))
        const sellPriceKey = Object.keys(row).find(k => k.toLowerCase().includes('sell') || k.toLowerCase().includes('price') && !k.toLowerCase().includes('cost') && !k.toLowerCase().includes('buy'))

        const excelName = row[nameKey]?.toString().trim()
        if (!excelName) return

        const excelBuyPrice = parseNumber(buyPriceKey ? row[buyPriceKey] : 0)
        const excelSellPrice = parseNumber(sellPriceKey ? row[sellPriceKey] : (buyPriceKey ? row[buyPriceKey] : 0)) // Fallback if only 1 price column

        let bestMatch: Product | null = null;
        let highestScore = 0; // closer to 1 is better

        // 1. First run Fuse.js
        const fuseResults = fuse.search(excelName);
        if (fuseResults.length > 0) {
          const fuseScore = 1 - (fuseResults[0].score || 1); // convert threshold (0=perfect) to score (1=perfect)
          if (fuseScore > 0.6) {
             bestMatch = fuseResults[0].item;
             highestScore = fuseScore;
          }
        }

        // 2. Try token overlap word-by-word
        currentProducts.forEach(dbProd => {
            const overlapScore = getWordOverlapScore(excelName, dbProd.name);
            if (overlapScore > highestScore && overlapScore > 0.75) { 
                highestScore = overlapScore;
                bestMatch = dbProd;
            }
        });

        if (bestMatch) {
          // A good match was found!
          // Check if this DB product has zero prices (Flow A target)
          if (Number(bestMatch.buy_price) === 0 && Number(bestMatch.sell_price) === 0) {
            // Prevent duplicates if multiple rows match the same product
            if (!newFlowAMatches.some(m => m.originalProduct.id === bestMatch!.id)) {
              newFlowAMatches.push({
                originalProduct: bestMatch,
                matchedName: excelName,
                newBuyPrice: excelBuyPrice,
                newSellPrice: excelSellPrice
              })
            }
          }
        } else {
          // No good match found in existing products. This is a "New Product" (Flow B)
          newFlowBProducts.push({
            name: excelName,
            buyPrice: excelBuyPrice,
            sellPrice: excelSellPrice,
            ...row // keep all other original data for export purposes
          })
        }
      })

      setFlowAMatches(newFlowAMatches)
      setFlowBNewProducts(newFlowBProducts)
      setStep('preview')

    } catch (err) {
      console.error("Error reading Excel", err)
      alert("Failed to read the Excel file. Please ensure it's a valid XLSX/XLS file.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAiMatch = async () => {
    setIsAiMatching(true)
    try {
      const dbTargets = currentProducts
        .filter(p => Number(p.buy_price) === 0 && Number(p.sell_price) === 0)
        .filter(p => !flowAMatches.some(m => m.originalProduct.id === p.id))
        .map(p => ({ id: p.id, name: p.name }))

      const excelTargets = flowBNewProducts.map(p => ({
        name: p.name,
        buyPrice: p.buyPrice,
        sellPrice: p.sellPrice
      }))

      if (dbTargets.length === 0 || excelTargets.length === 0) {
        alert("No more unmatched zero-price DB products or unmatched Excel products to evaluate.")
        return
      }

      const response = await fetch('/api/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excelItems: excelTargets, dbItems: dbTargets })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to communicate with AI endpoint")
      }

      const matches = await response.json()
      
      if (Array.isArray(matches) && matches.length > 0) {
        const newFlowA = [...flowAMatches]
        let currentFlowB = [...flowBNewProducts]
        
        let addedCount = 0;

        matches.forEach((match: { excelName: string, dbId: string }) => {
          const excelProd = currentFlowB.find(p => p.name === match.excelName)
          const dbProd = currentProducts.find(p => p.id === match.dbId)
          if (excelProd && dbProd && !newFlowA.some(m => m.originalProduct.id === dbProd.id)) {
            newFlowA.push({
              originalProduct: dbProd,
              matchedName: excelProd.name + " (AI Matched ✨)",
              newBuyPrice: excelProd.buyPrice,
              newSellPrice: excelProd.sellPrice
            })
            currentFlowB = currentFlowB.filter(p => p.name !== match.excelName)
            addedCount++
          }
        })
        
        setFlowAMatches(newFlowA)
        setFlowBNewProducts(currentFlowB)
        setActiveTab('A')
        alert(`AI successfully found ${addedCount} new matches!`)
      } else {
        alert("AI could not confidently find any more matches.")
      }
    } catch (err: any) {
      console.error(err)
      alert("AI Matching failed: " + err.message)
    } finally {
      setIsAiMatching(false)
    }
  }

  const handleApplyFlowA = async () => {
    if (flowAMatches.length === 0) return
    setIsUpdating(true)
    try {
      // Execute all updates in parallel
      await Promise.all(
        flowAMatches.map(match => 
          fetch(`/api/products/${match.originalProduct.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: match.originalProduct.name, // Keep DB name
              buy_price: match.newBuyPrice,
              sell_price: match.newSellPrice,
              stock: match.originalProduct.stock,
              unit: match.originalProduct.unit
            }),
          }).then(res => {
            if (!res.ok) throw new Error(`Failed to update ${match.originalProduct.name}`)
          })
        )
      )
      alert(`Successfully updated ${flowAMatches.length} products!`)
      onProductsUpdated() // Trigger reload of main list
      handleClose()
    } catch (err: any) {
      console.error(err)
      alert("An error occurred during update: " + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportFlowB = () => {
    if (flowBNewProducts.length === 0) return
    
    // Format for export
    const formattedData = flowBNewProducts.map(p => ({
      'Product Name': p.name,
      'Cost Price': p.buyPrice,
      'Selling Price': p.sellPrice,
    }))

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "New Products to Add")

    const fileName = `new_products_to_add_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  if (!isOpen) return null

  // Calculate some stats for the header
  const zeroPriceProducts = currentProducts.filter(p => Number(p.buy_price) === 0 && Number(p.sell_price) === 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Table2 className="h-5 w-5 text-indigo-600" />
              Smart Excel Import
            </h2>
            <p className="text-sm text-slate-500 mt-1">Intelligently update prices and identify new products.</p>
          </div>
          <button onClick={handleClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {step === 'upload' ? (
            <div className="max-w-xl mx-auto py-12">
              <div className="bg-white p-8 rounded-xl border border-slate-200 border-dashed text-center">
                <div className="mx-auto h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Excel File</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Select an Excel file (.xlsx, .xls) containing your product data. We will automatically match names and extract prices.
                </p>
                <div className="flex justify-center flex-col items-center gap-4">
                  <Button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 font-medium" disabled={isProcessing}>
                    {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Select Excel File'}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <span>{zeroPriceProducts.length} product(s) with zero prices await fixing.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shrink-0">
                <button 
                  onClick={() => setActiveTab('A')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'A' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Flow A: Ready to Fix ({flowAMatches.length})
                </button>
                <button 
                  onClick={() => setActiveTab('B')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'B' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <AlertCircle className="h-4 w-4" />
                  Flow B: New to Add ({flowBNewProducts.length})
                </button>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
                {activeTab === 'A' && (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <h4 className="font-semibold text-slate-800">Matched Zero-Price Products</h4>
                        <p className="text-sm text-slate-500">We found new prices for these products in your Excel file.</p>
                      </div>
                      <Button 
                        onClick={handleApplyFlowA} 
                        disabled={flowAMatches.length === 0 || isUpdating}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isUpdating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : `Update ${flowAMatches.length} Products`}
                      </Button>
                    </div>

                    {flowBNewProducts.length > 0 && currentProducts.filter(p => Number(p.buy_price) === 0 && Number(p.sell_price) === 0).length > flowAMatches.length && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex items-center justify-between border-b border-indigo-100">
                        <div>
                          <h5 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-purple-500" /> Use AI Magic Match</h5>
                          <p className="text-xs text-indigo-700 mt-1">Let Gemini AI intuitively match remaining names (e.g., "iPhone 13 128G" to "Apple iPhone 13 (128GB)").</p>
                        </div>
                        <Button 
                          onClick={handleAiMatch} 
                          disabled={isAiMatching}
                          variant="outline"
                          className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 shadow-sm"
                        >
                          {isAiMatching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking...</> : <><Sparkles className="mr-2 h-4 w-4 text-purple-500" /> Auto-Match with AI</>}
                        </Button>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      {flowAMatches.length > 0 ? (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-3 font-medium">DB Product Name</th>
                              <th className="px-4 py-3 font-medium">Matched Excel Name</th>
                              <th className="px-4 py-3 font-medium text-right">New Cost Price</th>
                              <th className="px-4 py-3 font-medium text-right">New Selling Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {flowAMatches.map((m, i) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-900">{m.originalProduct.name}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{m.matchedName}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{m.newBuyPrice.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{m.newSellPrice.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-12 text-center text-slate-500">
                          <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                          <p>No zero-price products matched with the uploaded Excel file.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'B' && (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <h4 className="font-semibold text-slate-800">Unmatched (New) Products</h4>
                        <p className="text-sm text-slate-500">These rows didn't match any existing products. Export them to add later.</p>
                      </div>
                      <Button 
                        onClick={handleExportFlowB} 
                        disabled={flowBNewProducts.length === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                        variant="default"
                      >
                        <Download className="mr-2 h-4 w-4" /> Export Missing Products
                      </Button>
                    </div>
                    
                    {flowBNewProducts.length > 0 && currentProducts.some(p => Number(p.buy_price) === 0 && Number(p.sell_price) === 0) && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex items-center justify-between border-b border-indigo-100">
                        <div>
                          <h5 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-purple-500" /> Use AI Magic Match</h5>
                          <p className="text-xs text-indigo-700 mt-1">Let Gemini AI intuitively match remaining names (e.g., "iPhone 13 128G" to "Apple iPhone 13 (128GB)").</p>
                        </div>
                        <Button 
                          onClick={handleAiMatch} 
                          disabled={isAiMatching}
                          variant="outline"
                          className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 shadow-sm"
                        >
                          {isAiMatching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking...</> : <><Sparkles className="mr-2 h-4 w-4 text-purple-500" /> Auto-Match with AI</>}
                        </Button>
                      </div>
                    )}
                    
                    <div className="overflow-x-auto max-h-[400px]">
                      {flowBNewProducts.length > 0 ? (
                         <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 font-medium">Excel Product Name</th>
                              <th className="px-4 py-3 font-medium text-right">Cost Price</th>
                              <th className="px-4 py-3 font-medium text-right">Selling Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {flowBNewProducts.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-900">{p.name || '-'}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{p.buyPrice.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{p.sellPrice.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-12 text-center text-slate-500">
                          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                          <p>All items in the Excel file matched existing products!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {step === 'preview' && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-start rounded-b-xl">
             <Button variant="outline" onClick={() => setStep('upload')}>
                Upload a different file
             </Button>
          </div>
        )}
      </div>
    </div>
  )
}
