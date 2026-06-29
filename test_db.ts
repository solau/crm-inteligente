import { supabaseAdmin } from './src/lib/supabase';

async function test() {
  const { data } = await supabaseAdmin.from('clients').select('*').ilike('name', '%Francisco Bottazzi%').single();
  console.log(data);
}
test();
