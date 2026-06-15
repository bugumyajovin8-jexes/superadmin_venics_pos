import express from "express";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

app.use(express.json());

// Get products for a given shop
app.get("/api/shops/:shopId/products", async (req, res) => {
  try {
    const { shopId } = req.params;
    
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, name, buy_price, sell_price, stock, unit')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .order('name');
      
    if (error) throw error;
    
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

export default app;
