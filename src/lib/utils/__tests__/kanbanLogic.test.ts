import { getKanbanColumns, KanbanClient, ClientInteractions } from '../kanbanLogic';

describe('Kanban Logic - Cooldown and Priority Rules', () => {
  const baseClient: KanbanClient = {
    id: '1',
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

  test('Deve colocar em POS_VENDA se a compra foi entre -1 e 7 dias', () => {
    const client = { ...baseClient, last_purchase_date: createDate(-3) };
    const result = getKanbanColumns([client], {}, new Set());
    expect(result.colPosVenda).toHaveLength(1);
    expect(result.colPosVenda[0].id).toBe('1');
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

  test('DEVE colocar em POS_VENDA se houve nova compra APÓS o último contato', () => {
    const interactionDate = createDate(-5); // Contatado há 5 dias
    const purchaseDate = createDate(-1);    // Comprou de novo ontem
    const client = { ...baseClient, last_purchase_date: purchaseDate };
    
    const interactions: Record<string, ClientInteractions> = {
      '1': { latest: { date: interactionDate, campaign: 'POS_VENDA' }, latestPosVenda: { date: interactionDate, campaign: 'POS_VENDA' } }
    };

    const result = getKanbanColumns([client], interactions, new Set());
    expect(result.colPosVenda).toHaveLength(1);
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

});
