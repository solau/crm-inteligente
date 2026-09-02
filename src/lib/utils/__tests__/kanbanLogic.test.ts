import { getKanbanColumns, KanbanClient, ClientInteractions } from '../kanbanLogic';

describe('Kanban Logic - Cooldown and Priority Rules', () => {
  const baseClient: KanbanClient = {
    id: '1',
    phone: '71999880315',
    next_expire_date: null,
    last_purchase_date: null,
    has_active: false
  };

  const createDate = (daysOffset: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString();
  };

  test('Deve colocar em CORRIDA_ALPHAVILLE se o lead tem tag Corrida Alphaville e não tem compra prévia', () => {
    const lead = { ...baseClient, preferences: 'Origem: Corrida Alphaville', total_spent: 0, last_purchase_date: null };
    const result = getKanbanColumns([lead], {}, new Set());
    expect(result.colCorridaAlphaville).toHaveLength(1);
    expect(result.colCorridaAlphaville[0].id).toBe('1');
  });

  test('Deve colocar em LEADS_BPE25 se o lead tem tag BPE25 e não tem compra prévia', () => {
    const lead = { ...baseClient, preferences: 'Origem: Leads BPE25', total_spent: 0, last_purchase_date: null };
    const result = getKanbanColumns([lead], {}, new Set());
    expect(result.colBpe25).toHaveLength(1);
    expect(result.colBpe25[0].id).toBe('1');
  });

  test('Lead de BPE25 ou Corrida NÃO deve aparecer se recebeu mensagem nos últimos 15 dias (Anti-Spam)', () => {
    const lead = { ...baseClient, preferences: 'Origem: Leads BPE25', total_spent: 0, last_purchase_date: null };
    const recentInteractions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-5), campaign: 'LEADS_BPE25' }, latestPosVenda: null }
    };
    const result = getKanbanColumns([lead], recentInteractions, new Set());
    expect(result.colBpe25).toHaveLength(0); // Bloqueado no 5º dia
  });

  test('Lead de BPE25 ou Corrida DEVE voltar a aparecer após completar 15 dias do último contato', () => {
    const lead = { ...baseClient, preferences: 'Origem: Leads BPE25', total_spent: 0, last_purchase_date: null };
    const expiredCooldownInteractions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-15), campaign: 'LEADS_BPE25' }, latestPosVenda: null }
    };
    const result = getKanbanColumns([lead], expiredCooldownInteractions, new Set());
    expect(result.colBpe25).toHaveLength(1); // Liberado no 15º dia
    expect(result.colBpe25[0].id).toBe('1');
  });

  test('Deve colocar em LEADS_WHATSAPP se o lead tem tag Leads - Whatsapp e não tem compra prévia', () => {
    const lead = { ...baseClient, preferences: 'Origem: Leads - Whatsapp (Kommo)', total_spent: 0, last_purchase_date: null };
    const result = getKanbanColumns([lead], {}, new Set());
    expect(result.colLeadsWhatsapp).toHaveLength(1);
    expect(result.colLeadsWhatsapp[0].id).toBe('1');
  });

  test('Lead de Leads - Whatsapp NÃO deve aparecer se recebeu mensagem nos últimos 15 dias (Anti-Spam)', () => {
    const lead = { ...baseClient, preferences: 'Origem: Leads - Whatsapp (Kommo)', total_spent: 0, last_purchase_date: null };
    const recentInteractions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-5), campaign: 'LEADS_WHATSAPP' }, latestPosVenda: null }
    };
    const result = getKanbanColumns([lead], recentInteractions, new Set());
    expect(result.colLeadsWhatsapp).toHaveLength(0);
  });

  test('Lead importado (Leads - Whatsapp) que efetua primeira compra NÃO deve mais aparecer em Leads - Whatsapp e deve entrar em POS_VENDA após 3 dias', () => {
    const convertedLead = {
      ...baseClient,
      preferences: 'Origem: Leads - Whatsapp (Kommo)',
      total_spent: 250,
      last_purchase_date: createDate(-3) // Comprou há 3 dias
    };
    const result = getKanbanColumns([convertedLead], {}, new Set());
    expect(result.colLeadsWhatsapp).toHaveLength(0);
    expect(result.colPosVenda).toHaveLength(1);
    expect(result.colPosVenda[0].id).toBe('1');
  });

  test('Deve colocar em POS_VENDA se a compra foi entre 3 e 7 dias atrás', () => {
    const client = { ...baseClient, last_purchase_date: createDate(-3) };
    const result = getKanbanColumns([client], {}, new Set());
    expect(result.colPosVenda).toHaveLength(1);
    expect(result.colPosVenda[0].id).toBe('1');
  });

  test('NÃO deve colocar em POS_VENDA se a compra foi há menos de 3 dias (ex: HOJE ou ontem)', () => {
    const clientToday = { ...baseClient, last_purchase_date: createDate(0) };
    const clientYesterday = { ...baseClient, last_purchase_date: createDate(-1) };
    const client2DaysAgo = { ...baseClient, last_purchase_date: createDate(-2) };
    
    expect(getKanbanColumns([clientToday], {}, new Set()).colPosVenda).toHaveLength(0);
    expect(getKanbanColumns([clientYesterday], {}, new Set()).colPosVenda).toHaveLength(0);
    expect(getKanbanColumns([client2DaysAgo], {}, new Set()).colPosVenda).toHaveLength(0);
  });

  test('NÃO deve colocar em POS_VENDA se o contato na campanha POS_VENDA for mais recente que a compra', () => {
    const purchaseDate = createDate(-3);
    const interactionDate = createDate(-1);
    const client = { ...baseClient, last_purchase_date: purchaseDate };
    
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: interactionDate, campaign: 'POS_VENDA' }, latestPosVenda: { date: interactionDate, campaign: 'POS_VENDA' } }
    };

    const result = getKanbanColumns([client], interactions, new Set());
    expect(result.colPosVenda).toHaveLength(0);
  });

  test('NÃO deve aparecer em POS_VENDA se recebeu POS_VENDA nos últimos 15 dias (cooldown absoluto)', () => {
    // Caso Andreza Blena: recebeu POS_VENDA há 8 dias, depois comprou de novo há 3 dias.
    // Cooldown de 15d ainda não expirou → NÃO deve aparecer
    const posVendaDate = createDate(-8);
    const newPurchaseDate = createDate(-3);
    const client = { ...baseClient, last_purchase_date: newPurchaseDate };
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: posVendaDate, campaign: 'POS_VENDA' }, latestPosVenda: { date: posVendaDate, campaign: 'POS_VENDA' } }
    };
    const result = getKanbanColumns([client], interactions, new Set());
    // Cooldown de 15d ainda ativo → NÃO deve aparecer
    expect(result.colPosVenda.map(c => c.id)).not.toContain('1');
  });

  test('DEVE aparecer em POS_VENDA se cooldown de 15d expirou E houve nova compra após o último POS_VENDA', () => {
    // POS_VENDA há 16 dias, nova compra há 2 dias → cooldown expirado E nova compra → aparece
    const posVendaDate = createDate(-16);
    const newPurchaseDate = createDate(-2);
    const client = { ...baseClient, last_purchase_date: newPurchaseDate };
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: posVendaDate, campaign: 'POS_VENDA' }, latestPosVenda: { date: posVendaDate, campaign: 'POS_VENDA' } }
    };
    const result = getKanbanColumns([client], interactions, new Set());
    expect(result.colPosVenda.map(c => c.id)).toContain('1');
  });

  test('Regra 15 Dias: Contato esconde o card de 10 dias e reaparece em 5 dias', () => {
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-3), campaign: 'CASHBACK_15D' }, latestPosVenda: null }
    };
    
    // Faltam 10 dias (não deve aparecer porque está no cooldown > 5)
    const client10d = { ...baseClient, has_active: true, next_expire_date: createDate(10) };
    let result = getKanbanColumns([client10d], interactions, new Set());
    expect(result.col10d).toHaveLength(0);

    // Faltam 5 dias (deve reaparecer porque <= 5 ignora o cooldown do 15D)
    const client5d = { ...baseClient, has_active: true, next_expire_date: createDate(5) };
    result = getKanbanColumns([client5d], interactions, new Set());
    expect(result.col5d).toHaveLength(1);
  });

  test('Regra 10 Dias: Contato esconde o card de 5 dias e reaparece no último dia', () => {
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-3), campaign: 'CASHBACK_10D' }, latestPosVenda: null }
    };
    
    // Faltam 5 dias (não deve aparecer porque está no cooldown > 1)
    const client5d = { ...baseClient, has_active: true, next_expire_date: createDate(5) };
    let result = getKanbanColumns([client5d], interactions, new Set());
    expect(result.col5d).toHaveLength(0);

    // Faltam 1 dia (deve reaparecer porque <= 1 ignora o cooldown do 10D)
    const client1d = { ...baseClient, has_active: true, next_expire_date: createDate(1) };
    result = getKanbanColumns([client1d], interactions, new Set());
    expect(result.col1d).toHaveLength(1);
  });

  test('Regra 5 Dias: Contato esconde e reaparece no último dia', () => {
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-3), campaign: 'CASHBACK_5D' }, latestPosVenda: null }
    };
    
    // Faltam 3 dias (não deve aparecer porque está no cooldown > 1)
    const client3d = { ...baseClient, has_active: true, next_expire_date: createDate(3) };
    let result = getKanbanColumns([client3d], interactions, new Set());
    expect(result.col5d).toHaveLength(0);

    // Faltam 1 dia (deve reaparecer porque <= 1 ignora o cooldown do 5D)
    const client1d = { ...baseClient, has_active: true, next_expire_date: createDate(1) };
    result = getKanbanColumns([client1d], interactions, new Set());
    expect(result.col1d).toHaveLength(1);
  });

  test('Qualquer contato HOJE aplica cooldown global (card some até virar o dia)', () => {
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(0), campaign: 'CASHBACK_1D' }, latestPosVenda: null }
    };
    
    // Mesmo faltando 1 dia (Expira hoje), se contatou HOJE, ele não deve aparecer.
    const client1d = { ...baseClient, has_active: true, next_expire_date: createDate(1) };
    const result = getKanbanColumns([client1d], interactions, new Set());
    expect(result.col1d).toHaveLength(0);
  });

  test('Regra Ausentes: Mensagem enviada há exatos 15 dias libera o cliente no Kanban (cooldown encerra no 15º dia)', () => {
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-15), campaign: 'OFERTA_90D' }, latestPosVenda: null },
      '2': { latest: { date: createDate(-15), campaign: 'AUSENTE_45D' }, latestPosVenda: null },
      '3': { latest: { date: createDate(-14), campaign: 'OFERTA_90D' }, latestPosVenda: null }
    };

    const client90d = { ...baseClient, id: '1', phone: '71999880315', last_purchase_date: createDate(-100) };
    const client45d = { ...baseClient, id: '2', phone: '71999565604', last_purchase_date: createDate(-60) };
    const clientBlocked = { ...baseClient, id: '3', phone: '71999999999', last_purchase_date: createDate(-100) };

    const result = getKanbanColumns([client90d, client45d, clientBlocked], interactions, new Set());
    
    // Cliente 1 (há 15 dias) DEVE aparecer na col90d (Liberado!)
    expect(result.col90d.map(c => c.id)).toContain('1');
    // Cliente 2 (há 15 dias) DEVE aparecer na col45d (Liberado!)
    expect(result.col45d.map(c => c.id)).toContain('2');
    // Cliente 3 (há 14 dias) AINDA DEVE estar bloqueado
    expect(result.col90d.map(c => c.id)).not.toContain('3');
  });

  test('Regra Cashback Expirado: Cashback sem saldo ativo não bloqueia ausente 45d/90d', () => {
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: createDate(-5), campaign: 'CASHBACK_1D' }, latestPosVenda: null }
    };

    // Cliente comprou há 60 dias, teve cashback expirado há 5 dias
    const client = { ...baseClient, id: '1', phone: '71999880315', has_active: false, last_purchase_date: createDate(-60) };
    const result = getKanbanColumns([client], interactions, new Set());
    expect(result.col45d.map(c => c.id)).toContain('1');
  });

  test('Pós-Venda: Interação de CASHBACK no mesmo dia da compra NÃO deve bloquear POS_VENDA', () => {
    // Vendedor mandou cashback/qualquer coisa no mesmo dia da compra, mas não o POS_VENDA
    // Cliente ainda precisa receber o pós-venda
    const purchaseDate = createDate(-2);
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: purchaseDate, campaign: 'CASHBACK_15D' }, latestPosVenda: null }
    };
    const client = { ...baseClient, last_purchase_date: purchaseDate };
    const result = getKanbanColumns([client], interactions, new Set());
    // Comprou há 2 dias, só recebeu CASHBACK, não POS_VENDA → DEVE aparecer no Pós-Venda
    expect(result.colPosVenda.map(c => c.id)).toContain('1');
  });

  test('Pós-Venda: Interação de CASHBACK após a compra NÃO deve bloquear POS_VENDA', () => {
    // Vendedor mandou cashback 1 dia depois da compra, cliente nunca recebeu pós-venda
    const purchaseDate = createDate(-3);
    const cashbackDate = createDate(-2); // dia seguinte à compra
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: cashbackDate, campaign: 'CASHBACK_1D' }, latestPosVenda: null }
    };
    const client = { ...baseClient, last_purchase_date: purchaseDate };
    const result = getKanbanColumns([client], interactions, new Set());
    // Nunca recebeu POS_VENDA → DEVE aparecer
    expect(result.colPosVenda.map(c => c.id)).toContain('1');
  });

  test('Pós-Venda: POS_VENDA há 5 dias + nova compra → ainda no cooldown (15d absoluto)', () => {
    // Recebeu POS_VENDA há 5 dias, depois comprou de novo há 1 dia
    // O cooldown de 15 dias ainda NÃO expirou → não deve aparecer
    const posVendaDate = createDate(-5);
    const newPurchaseDate = createDate(-1);
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: posVendaDate, campaign: 'POS_VENDA' }, latestPosVenda: { date: posVendaDate, campaign: 'POS_VENDA' } }
    };
    const client = { ...baseClient, last_purchase_date: newPurchaseDate };
    const result = getKanbanColumns([client], interactions, new Set());
    // Cooldown de 15d ainda ativo → NÃO deve aparecer mesmo com nova compra
    expect(result.colPosVenda.map(c => c.id)).not.toContain('1');
  });

  test('Pós-Venda: POS_VENDA após a compra bloqueia corretamente', () => {
    // Recebeu POS_VENDA ontem, comprou há 3 dias → já atendido
    const purchaseDate = createDate(-3);
    const posVendaDate = createDate(-1);
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: posVendaDate, campaign: 'POS_VENDA' }, latestPosVenda: { date: posVendaDate, campaign: 'POS_VENDA' } }
    };
    const client = { ...baseClient, last_purchase_date: purchaseDate };
    const result = getKanbanColumns([client], interactions, new Set());
    // Já recebeu POS_VENDA após a compra → NÃO deve aparecer
    expect(result.colPosVenda.map(c => c.id)).not.toContain('1');
  });

});
