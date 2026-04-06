import { createClient } from '@supabase/supabase-js'

// Provide fallback values to prevent the app from crashing if environment variables are not set yet.
// The user will need to set these in the AI Studio Secrets panel.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
