import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Supabase admin client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  app.use(express.json());

  // API endpoints
  
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
