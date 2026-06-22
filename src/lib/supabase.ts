import { createClient } from '@supabase/supabase-js'

// Provide fallback values to prevent the app from crashing if environment variables are not set yet.
// The user will need to set these in the AI Studio Secrets panel.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const fetchAllRecords = async (queryBuilder: any) => {
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
