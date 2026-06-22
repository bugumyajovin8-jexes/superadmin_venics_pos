import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function test() {
  const q = supabaseAdmin.from("products").select("id").limit(10);
  const r1 = await q.range(0, 1);
  const r2 = await q.range(2, 3);
  console.log("R1", r1.data?.length);
  console.log("R2", r2.data?.length);
}
test().catch(console.error);
