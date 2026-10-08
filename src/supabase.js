import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://luipoyhjbyhechpuoqco.supabase.co'
const supabaseAnonKey = 'sb_publishable_iI58d0DVZvG1ZtCjkrKm-Q_XiBrVMlM'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
