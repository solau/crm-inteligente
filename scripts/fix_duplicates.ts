import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';
  console.log('Iniciando limpeza de cashbacks duplicados...');

  // 1. Puxa todos os cashbacks (com paginação para evitar limite de 1000)
  const allCashbacks = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('cashback_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .range(from, from + step - 1);
    
    if (error || !data) {
      console.error('Erro ao buscar cashbacks:', error);
      return;
    }
    
    if (data.length === 0) break;
    allCashbacks.push(...data);
    from += step;
  }
  const cashbacks = allCashbacks;
  console.log(`Buscados ${cashbacks.length} cashbacks no total.`);

  // 2. Agrupa por order_id para encontrar duplicatas
  const orderMap = new Map<string, any[]>();
  for (const c of cashbacks) {
    if (!orderMap.has(c.order_id)) orderMap.set(c.order_id, []);
    orderMap.get(c.order_id)!.push(c);
  }

  // 3. Remove duplicatas (mantém a primeira entrada)
  const idsToRemove: string[] = [];
  const uniqueCashbacks: any[] = [];
  for (const [orderId, entries] of orderMap.entries()) {
    // Ordena por data de criação para manter o mais antigo
    entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    uniqueCashbacks.push(entries[0]); // O que vai ficar

    // Os demais serão deletados
    for (let i = 1; i < entries.length; i++) {
      idsToRemove.push(entries[i].id);
    }
  }

  if (idsToRemove.length > 0) {
    console.log(`Deletando ${idsToRemove.length} cashbacks duplicados...`);
    // Deleta em lotes de 100
    for (let i = 0; i < idsToRemove.length; i += 100) {
      const batch = idsToRemove.slice(i, i + 100);
      await supabaseAdmin.from('cashback_ledger').delete().in('id', batch);
    }
    console.log('Deleção concluída.');
  } else {
    console.log('Nenhuma duplicata encontrada no ledger.');
  }

  // 4. Recalcula o saldo e total_spent dos clientes usando os cashbacks ÚNICOS
  console.log('Recalculando os totais dos clientes...');
  const clientMap = new Map<string, { total_spent: number, active_balance: number, count: number, last_purchase: Date | null }>();
  
  for (const c of uniqueCashbacks) {
    if (!clientMap.has(c.client_id)) {
      clientMap.set(c.client_id, { total_spent: 0, active_balance: 0, count: 0, last_purchase: null });
    }
    const stat = clientMap.get(c.client_id)!;
    
    // total_spent é 10x o cashback gerado original (já que cashback é 10%)
    stat.total_spent += (c.original_amount * 10);
    
    if (c.status === 'ATIVO') {
      stat.active_balance += c.remaining_amount;
    }

    stat.count += 1;

    const orderDate = new Date(c.created_at);
    if (!stat.last_purchase || orderDate > stat.last_purchase) {
      stat.last_purchase = orderDate;
    }
  }

  let updatedClients = 0;
  for (const [clientId, stat] of clientMap.entries()) {
    // Calcula Lead Score Base: 10 * compras + R$ 1 por R$ 100 gastos
    let baseRFM = (10 * stat.count) + Math.floor(stat.total_spent / 100);
    baseRFM = Math.min(100, baseRFM);
    
    let penalty = 0;
    if (stat.last_purchase) {
      const diffTime = Math.abs(new Date().getTime() - stat.last_purchase.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 90) penalty = 70;
      else if (diffDays > 60) penalty = 40;
      else if (diffDays > 30) penalty = 20;
    }

    let finalScore = baseRFM - penalty;
    finalScore = Math.max(0, Math.min(100, finalScore));

    await supabaseAdmin.from('clients').update({
      total_spent: stat.total_spent,
      cashback_balance: stat.active_balance,
      base_lead_score: baseRFM,
      lead_score: finalScore,
      last_purchase_date: stat.last_purchase?.toISOString()
    }).eq('id', clientId);
    
    updatedClients++;
  }

  console.log(`Reconstrução finalizada com sucesso para ${updatedClients} clientes.`);
}

run();
