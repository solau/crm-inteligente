import { createClient } from '@supabase/supabase-js';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

// Usamos o Service Role Key internamente nas APIs de Backend (Node)
// para burlar o RLS quando o sistema precisa agir autonomamente (ex: Webhooks do Bling).
// ATENÇÃO: NUNCA exporte isso para componentes frontend!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
