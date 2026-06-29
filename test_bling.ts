import { createClient } from '@supabase/supabase-js';
import Bling from 'bling-erp-api';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';
  const { data } = await supabaseAdmin.from('bling_credentials').select('*').eq('tenant_id', tenantId).single();
  
  if (!data) return console.log('Sem token');
  
  const bling = new Bling(data.access_token);
  
  try {
    const response = await bling.pedidosVendas.get({ limite: 1 });
    console.log(JSON.stringify(response.data[0], null, 2));
  } catch (e: any) {
    console.log('Erro:', e.message);
  }
}

run();
