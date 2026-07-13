import fs from 'fs';

async function run() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/tenants`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      id: 'd948b6cc-cc2c-4399-8525-02f17f281d38',
      name: 'Alpha Bull',
      business_context: 'Boutique de Carnes Alpha Bull. Vende cortes premium (Wagyu, Angus).'
    })
  });
  
  if (response.ok || response.status === 409) {
    console.log("Tenant Alpha Bull inserido com sucesso (ou já existe)!");
  } else {
    console.error("Erro ao inserir Tenant:", await response.text());
  }
}

run();
