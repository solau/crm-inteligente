require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('bling_credentials').delete().neq('id', '00000000-0000-0000-0000-000000000000').then((res) => console.log('Apagado:', res));
