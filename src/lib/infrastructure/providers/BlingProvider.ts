import { supabaseAdmin } from '@/lib/supabase';
import Bling from 'bling-erp-api';

export interface HistoricalOrder {
  bling_id: string;
  nome: string;
  telefone: string;
  order_id: string;
  data: string; // ISO Date
  total_gasto: number;
  desconto: number;
  situacao: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class BlingProvider {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async getValidToken(): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('bling_credentials')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .single();
      
    if (error || !data) return null;

    // Verifica se expirou (com margem de 5 minutos de segurança)
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);

    if (now > expiresAt && data.refresh_token) {
      console.log('Token do Bling expirado. Realizando refresh...');
      
      const clientId = process.env.BLING_CLIENT_ID;
      const clientSecret = process.env.BLING_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Credenciais do Bling não configuradas no servidor.');
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '1.0'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: data.refresh_token
        })
      });

      if (!response.ok) {
        console.error('Falha ao dar refresh no token do Bling:', await response.text());
        return null;
      }

      const authResponse = await response.json();
      
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + authResponse.expires_in);

      await supabaseAdmin.from('bling_credentials').update({
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
        expires_at: newExpiresAt.toISOString()
      }).eq('tenant_id', this.tenantId);

      return authResponse.access_token;
    }

    return data.access_token;
  }

  async fetchHistoricalData(): Promise<HistoricalOrder[]> {
    const token = await this.getValidToken();
    if (!token) throw new Error('Bling não autenticado.');
    
    console.log('Iniciando busca real na API do Bling...');
    const bling = new Bling(token);
    
    // ETAPA 1: Baixar todos os pedidos
    const todosPedidos: any[] = [];
    let paginaPedidos = 1;
    let buscandoPedidos = true;

    console.log('--- ETAPA 1: Baixando Histórico de Pedidos ---');
    while (buscandoPedidos) {
      console.log(`Buscando página ${paginaPedidos} de Pedidos no Bling...`);
      try {
        const response = await bling.pedidosVendas.get({ pagina: paginaPedidos, limite: 100 });
        const pedidos = response?.data || [];
        
        if (pedidos.length === 0) {
          buscandoPedidos = false;
          break;
        }

        todosPedidos.push(...pedidos);
        paginaPedidos++;
        await sleep(400); // 2.5 requests per second (seguro contra o limite de 3/s)
      } catch (error: any) {
        if (error?.message?.includes('404') || error?.response?.status === 404 || error?.rawResponse?.error?.type === 'NOT_FOUND') {
          buscandoPedidos = false;
        } else if (error?.response?.status === 429 || error?.rawResponse?.error?.type === 'TOO_MANY_REQUESTS' || error?.message?.includes('limite de requisições')) {
          console.log('Rate limit atingido. Dormindo 3 segundos...');
          await sleep(3000);
        } else {
          throw error;
        }
      }
    }

    // MAPA 2: Busca os telefones reais dos Contatos no Bling
    const contactMap = new Map<string, string>(); // blingId -> telefone limpo
    let paginaContatos = 1;
    let buscandoContatos = true;

    console.log('--- ETAPA 2: Baixando agenda de Contatos (Telefones) ---');
    while (buscandoContatos) {
      console.log(`Buscando página ${paginaContatos} de Contatos no Bling...`);
      try {
        const response = await bling.contatos.get({ pagina: paginaContatos, limite: 100 });
        const contatos = response?.data || [];
        
        if (contatos.length === 0) {
          buscandoContatos = false;
          break;
        }

        for (const contato of contatos) {
          if (!contato.id) continue;
          const blingId = contato.id.toString();
          
          const foneBruto = contato.celular || contato.telefone;
          if (!foneBruto) continue;

          const foneLimpo = foneBruto.replace(/\D/g, '');
          if (foneLimpo.length >= 10) {
            contactMap.set(blingId, foneLimpo);
          }
        }

        paginaContatos++;
        await sleep(400); // 2.5 req/s
      } catch (error: any) {
        if (error?.message?.includes('404') || error?.response?.status === 404 || error?.rawResponse?.error?.type === 'NOT_FOUND') {
          buscandoContatos = false;
        } else if (error?.response?.status === 429 || error?.rawResponse?.error?.type === 'TOO_MANY_REQUESTS' || error?.message?.includes('limite de requisições')) {
          console.log('Rate limit atingido. Dormindo 3 segundos...');
          await sleep(3000);
        } else {
          throw error;
        }
      }
    }

    console.log(`Agenda de contatos concluída.`);
    
    // ETAPA 3: Monta a lista de HistoricalOrders cronológica (do mais antigo pro mais novo)
    const finalOrders: HistoricalOrder[] = [];

    // Ordena do mais antigo para o mais novo
    todosPedidos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    for (const pedido of todosPedidos) {
      const contato = pedido.contato;
      if (!contato || !contato.id) continue;
      
      const blingId = contato.id.toString();
      const telefone = contactMap.get(blingId);
      
      if (!telefone) continue; // Cliente sem celular ignorado

      let valorDesconto = 0;
      
      const totalProdutos = Number(pedido.totalProdutos) || 0;
      const total = Number(pedido.total) || 0;
      const frete = Number(pedido.transporte?.frete) || 0;
      const outrasDespesas = Number(pedido.outrasDespesas) || 0;
      
      // O Bling calcula o Total da Venda como: Total Produtos - Desconto + Frete + Outras Despesas
      // Portanto: Desconto = Total Produtos + Frete + Outras Despesas - Total da Venda
      const descontoCalculado = totalProdutos + frete + outrasDespesas - total;
      
      if (descontoCalculado > 0) {
        valorDesconto = Number(descontoCalculado.toFixed(2));
      }

      finalOrders.push({
        bling_id: blingId,
        nome: contato.nome || 'Cliente Desconhecido',
        telefone: telefone,
        order_id: pedido.id ? pedido.id.toString() : `HIST-${Date.now()}`,
        data: pedido.data,
        total_gasto: total,
        desconto: valorDesconto,
        situacao: pedido.situacao?.id || 0
      });
    }

    console.log(`Exportando ${finalOrders.length} pedidos perfeitos para simulação do Ledger.`);
    return finalOrders;
  }

  // Busca um pedido específico completo (usado pelo Webhook)
  async getOrderById(orderId: string) {
    const token = await this.getValidToken();
    if (!token) throw new Error('Bling Provider não inicializado ou token inválido');

    try {
      const res = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const detail = await res.json();
      return detail?.data || null;
    } catch (e) {
      console.error(`Erro ao buscar detalhes do pedido ${orderId} no Bling:`, e);
      return null;
    }
  }

  // Busca as compras específicas de um contato no Bling
  async getClientStatement(blingId: string) {
    const token = await this.getValidToken();
    if (!token) throw new Error('Bling Provider não inicializado ou token inválido');
    
    const bling = new Bling(token);

    console.log(`[BlingProvider] Buscando histórico de pedidos para Contato: ${blingId}`);
    try {
      const response = await bling.pedidosVendas.get({ idContato: Number(blingId), limite: 100 });
      if (!response.data) return [];
      
      const orders = response.data;
      // Pega os 10 pedidos mais recentes
      const top10 = [...orders].sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 10);
      
      // Busca os itens detalhados apenas desses 10
      const detailedTop10: any[] = [];
      for (const pedido of top10) {
        try {
          await sleep(400); // Respeita rate limit de 3/seg
          // Usa fetch direto pois a SDK bling-erp-api pode ter problemas com .find()
          const res = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas/${pedido.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const detail = await res.json();
          detailedTop10.push({ id: pedido.id, detail: detail?.data });
        } catch (e) {
          console.error(`Erro ao buscar itens do pedido ${pedido.id}`);
          detailedTop10.push({ id: pedido.id, detail: null });
        }
      }

      // Filtramos e formatamos a resposta
      return orders.map((pedido: any) => {
        const fullDetail = detailedTop10.find(d => d.id === pedido.id)?.detail;
        
        let valorDesconto = 0;
        const totalProdutos = Number(pedido.totalProdutos) || 0;
        const total = Number(pedido.total) || 0;
        
        // Pega do detalhe completo se existir, senão tenta do resumo
        const frete = Number(fullDetail?.transporte?.frete || pedido.transporte?.frete) || 0;
        const outrasDespesas = Number(fullDetail?.outrasDespesas || pedido.outrasDespesas) || 0;
        
        const descontoCalculado = totalProdutos + frete + outrasDespesas - total;
        
        if (descontoCalculado > 0) {
          valorDesconto = Number(descontoCalculado.toFixed(2));
        }

        return {
          id: pedido.id,
          numero: pedido.numero,
          data: pedido.data,
          total: total,
          itens: fullDetail ? fullDetail.itens || [] : [],
          desconto: valorDesconto,
          situacao: pedido.situacao.id
        };
      });
    } catch (e: any) {
      if (e.message?.includes('We could not find any records')) {
        return [];
      }
      throw e;
    }
  }

  // Busca o estoque de uma lista de produtos
  async fetchProductStock(productIds: string[]) {
    if (productIds.length === 0) return {};
    const token = await this.getValidToken();
    if (!token) throw new Error('Bling Provider não inicializado ou token inválido');

    // Monta a query string: ?idsProdutos[]=1&idsProdutos[]=2
    const qs = productIds.map(id => `idsProdutos[]=${id}`).join('&');
    const url = `https://www.bling.com.br/Api/v3/estoques/saldos?${qs}`;

    console.log(`[BlingProvider] Buscando saldo de estoque para ${productIds.length} produtos.`);
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const detail = await res.json();
      
      const stockMap: Record<string, number> = {};
      if (detail && detail.data && Array.isArray(detail.data)) {
        for (const item of detail.data) {
          if (item.produto && item.produto.id) {
            stockMap[item.produto.id.toString()] = item.saldoVirtualTotal || 0;
          }
        }
      }
      return stockMap;
    } catch (e) {
      console.error('Erro ao buscar saldo de produtos no Bling:', e);
      return {};
    }
  }
}
