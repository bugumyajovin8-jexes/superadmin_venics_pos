import express from "express";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const fetchAllRecordsAsync = async (queryBuilder: any) => {
  let allData: any[] = [];
  let from = 0;
  const limit = 999;
  
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = [...allData, ...data];
    if (data.length < limit) break;
    from += limit;
  }
  return allData;
};

app.use(express.json());

// Get products for a given shop
app.get("/api/shops/:shopId/products", async (req, res) => {
  try {
    const { shopId } = req.params;
    
    const query = supabaseAdmin
      .from('products')
      .select('id, name, buy_price, sell_price, stock, unit')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .order('name');
      
    const data = await fetchAllRecordsAsync(query);
    
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new product
app.post("/api/shops/:shopId/products", async (req, res) => {
  try {
    const { shopId } = req.params;
    const { name, buy_price, sell_price, stock, unit } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([{
        shop_id: shopId,
        name,
        buy_price: Number(buy_price) || 0,
        sell_price: Number(sell_price) || 0,
        stock: Number(stock) || 0,
        unit: unit || 'pcs',
        is_deleted: false,
      }])
      .select()
      .single();
      
    if (error) throw error;
    
    res.json(data);
  } catch (error: any) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: error.message });
  }
});

// AI match products based on names and similarities using Gemini
app.post("/api/ai-match", async (req, res) => {
  try {
    const { excelItems, dbItems } = req.body;
    
    const apiKey = process.env.GEMINI_NEW_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_NEW_KEY is not configured in settings." });
    }
    
    const ai = new GoogleGenAI({ 
      apiKey: apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an intelligent product matcher. 
I have a list of products extracted from an Excel file that did not exactly match any database products via simple text comparisons.
I also have a list of zero-price products in my database.

Excel items: ${JSON.stringify(excelItems)}
Database zero-price items: ${JSON.stringify(dbItems)}

Please pair the Excel items to the Database items where you are fairly confident they represent the same product. 
For example, "iPhone 13 128G" from Excel should map to "Apple iPhone 13 (128GB)" in the database.
Only return matches that you are reasonably confident about. If an Excel item doesn't map to any DB item, skip it.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              excelName: { type: Type.STRING },
              dbId: { type: Type.STRING }
            },
            required: ["excelName", "dbId"]
          }
        },
        temperature: 0.2
      }
    });

    try {
      const result = JSON.parse(response.text.trim());
      res.json(result);
    } catch (parseError) {
      console.error("AI returned malformed JSON:", response.text);
      res.status(500).json({ error: "Failed to parse AI response" });
    }
  } catch (error: any) {
    console.error("Error in AI match:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update a product
app.put("/api/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, buy_price, sell_price, stock, unit } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        name,
        buy_price: Number(buy_price) || 0,
        sell_price: Number(sell_price) || 0,
        stock: Number(stock) || 0,
        unit: unit || 'pcs',
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();
      
    if (error) throw error;
    
    res.json(data);
  } catch (error: any) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get shop records (sales and sale items)
app.get("/api/shops/:shopId/records", async (req, res) => {
  try {
    const { shopId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const query = supabaseAdmin
      .from('sales')
      .select(`
        id, 
        created_at, 
        status, 
        sale_items (
          id, 
          product_name, 
          qty, 
          buy_price, 
          sell_price, 
          updated_at,
          created_at,
          products (
            sell_price
          )
        )
      `)
      .eq('shop_id', shopId)
      .gte('created_at', startDate as string)
      .lte('created_at', endDate as string);
      
    const data = await fetchAllRecordsAsync(query);
    
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching shop records:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get network analytics from telemetry
app.get("/api/analytics/network", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { shopId } = req.query;

    let query = supabaseAdmin
      .from('saas_telemetry')
      .select('shop_id, details, created_at')
      .eq('feature_key', 'network_usage')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const data = await fetchAllRecordsAsync(query);

    const shopStats: Record<string, { rawBytes: number, estTotalBytes: number, reqCount: number, ingressBytes: number, egressBytes: number }> = {};
    const tableStats: Record<string, { bytes: number, rows: number, reqCount: number }> = {};
    const payloadStats: Record<string, { totalBytes: number, maxBytes: number, reqCount: number }> = {};
    const dailyStats: Record<string, { bytes: number, requests: number, ingressBytes: number, egressBytes: number }> = {};

    (data || []).forEach(record => {
      const details = record.details || {};
      const actualShopId = record.shop_id || 'unknown';
      const bytes = Number(details.bytes) || 0;
      const estTotalBytes = Number(details.estimated_total_bytes) || 0;
      const direction = details.direction || 'unknown';
      const tableKey = `${details.table_name || 'unknown'}_${direction}`;
      const rowsCount = Number(details.rows_count) || 0;
      
      const isIngress = direction === 'push';
      const isEgress = direction === 'pull';

      // Daily Stats (For graph)
      const dateStr = record.created_at ? record.created_at.split('T')[0] : 'unknown';
      if (dateStr !== 'unknown') {
        if (!dailyStats[dateStr]) {
          dailyStats[dateStr] = { bytes: 0, requests: 0, ingressBytes: 0, egressBytes: 0 };
        }
        dailyStats[dateStr].bytes += estTotalBytes;
        if (isIngress) dailyStats[dateStr].ingressBytes += estTotalBytes;
        if (isEgress) dailyStats[dateStr].egressBytes += estTotalBytes;
        dailyStats[dateStr].requests += 1;
      }

      // 1. Shop Egress/Ingress
      if (!shopStats[actualShopId]) {
        shopStats[actualShopId] = { rawBytes: 0, estTotalBytes: 0, reqCount: 0, ingressBytes: 0, egressBytes: 0 };
      }
      shopStats[actualShopId].rawBytes += bytes;
      shopStats[actualShopId].estTotalBytes += estTotalBytes;
      if (isIngress) shopStats[actualShopId].ingressBytes += estTotalBytes;
      if (isEgress) shopStats[actualShopId].egressBytes += estTotalBytes;
      shopStats[actualShopId].reqCount += 1;

      // 2. Table Egress/Ingress Split
      if (!tableStats[tableKey]) {
        tableStats[tableKey] = { bytes: 0, rows: 0, reqCount: 0 };
      }
      tableStats[tableKey].bytes += bytes;
      tableStats[tableKey].rows += rowsCount;
      tableStats[tableKey].reqCount += 1;

      // 3. Request Payloads 
      if (!payloadStats[tableKey]) {
        payloadStats[tableKey] = { totalBytes: 0, maxBytes: 0, reqCount: 0 };
      }
      payloadStats[tableKey].totalBytes += bytes;
      payloadStats[tableKey].maxBytes = Math.max(payloadStats[tableKey].maxBytes, bytes);
      payloadStats[tableKey].reqCount += 1;
    });

    const shopIds = Object.keys(shopStats).filter(id => id !== 'unknown');
    let shopNames: Record<string, string> = {};
    if (shopIds.length > 0) {
      for (let i = 0; i < shopIds.length; i += 999) {
        const chunk = shopIds.slice(i, i + 999);
        const query = supabaseAdmin
          .from('shops')
          .select('id, name')
          .in('id', chunk);
        const shops = await fetchAllRecordsAsync(query);
        shops.forEach(shop => {
          shopNames[shop.id] = shop.name;
        });
      }
    }

    const shopUsage = Object.entries(shopStats).map(([shop_id, stats]) => ({
      shop_id,
      shop_name: shopNames[shop_id] || shop_id,
      raw_gb_used: stats.rawBytes / (1024 * 1024 * 1024),
      est_total_gb_used: stats.estTotalBytes / (1024 * 1024 * 1024),
      raw_bytes: stats.rawBytes,
      est_total_bytes: stats.estTotalBytes,
      ingress_bytes: stats.ingressBytes,
      egress_bytes: stats.egressBytes,
      total_requests: stats.reqCount
    })).sort((a, b) => b.est_total_gb_used - a.est_total_gb_used);

    const tableUsage = Object.entries(tableStats).map(([key, stats]) => {
      const [table_name, sync_direction] = key.split('_');
      return {
        table_name,
        sync_direction,
        total_bytes: stats.bytes,
        total_rows_transferred: stats.rows,
        event_count: stats.reqCount
      };
    }).sort((a, b) => b.total_bytes - a.total_bytes);

    const payloadUsage = Object.entries(payloadStats).map(([key, stats]) => {
      const [table_name, sync_direction] = key.split('_');
      return {
        table_name,
        sync_direction,
        avg_bytes_per_request: stats.reqCount > 0 ? stats.totalBytes / stats.reqCount : 0,
        max_bytes_per_request: stats.maxBytes,
        total_requests: stats.reqCount
      };
    }).sort((a, b) => b.avg_bytes_per_request - a.avg_bytes_per_request);

    const dailyUsage = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      bytes: stats.bytes,
      ingress_bytes: stats.ingressBytes,
      egress_bytes: stats.egressBytes,
      requests: stats.requests
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      shopUsage,
      tableUsage,
      payloadUsage,
      dailyUsage
    });
  } catch (error: any) {
    console.error("Error fetching network analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
