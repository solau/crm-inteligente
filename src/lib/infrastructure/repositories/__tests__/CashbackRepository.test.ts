import { CashbackRepository, CashbackLedgerEntry } from '../CashbackRepository';

// Mock do supabaseAdmin para testar a unidade do CashbackRepository de forma segura e rápida
jest.mock('@/lib/supabase', () => {
  return {
    supabaseAdmin: {
      from: jest.fn()
    }
  };
});

import { supabaseAdmin } from '@/lib/supabase';

describe('CashbackRepository - Testes de Regra de Negócio de Cashback (FIFO + Resgate)', () => {
  let repository: CashbackRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CashbackRepository();
  });

  test('Deve abater o saldo de cashback mais antigo primeiro (Regra FIFO)', async () => {
    const tenantId = 'tenant-123';
    const clientId = 'client-456';
    const orderId = 'pedido-novo';

    // Mock de duas entradas ativas no ledger (uma mais antiga de R$ 30 e uma mais nova de R$ 50)
    const mockActiveCashbacks = [
      { id: 'ledger-antigo', remaining_amount: 30, status: 'ATIVO', expires_at: '2026-08-01' },
      { id: 'ledger-novo', remaining_amount: 50, status: 'ATIVO', expires_at: '2026-09-01' }
    ];

    const mockSelect = jest.fn().mockReturnThis();
    const mockEqTenant = jest.fn().mockReturnThis();
    const mockEqClient = jest.fn().mockReturnThis();
    const mockEqStatus = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockResolvedValue({ data: mockActiveCashbacks, error: null });

    const mockUpdate = jest.fn().mockReturnThis();
    const mockUpdateEq = jest.fn().mockResolvedValue({ data: null, error: null });

    (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'cashback_ledger') {
        return {
          select: mockSelect,
          eq: (field: string, val: any) => {
            if (field === 'tenant_id') return mockEqTenant;
            if (field === 'client_id') return mockEqClient;
            if (field === 'status') return mockEqStatus;
            if (field === 'id') return { update: mockUpdate, eq: mockUpdateEq };
            return mockSelect;
          },
          order: mockOrder,
          update: mockUpdate
        };
      }
      return {};
    });

    mockSelect.mockReturnValue({ eq: mockEqTenant });
    mockEqTenant.mockReturnValue({ eq: mockEqClient });
    mockEqClient.mockReturnValue({ eq: mockEqStatus });
    mockEqStatus.mockReturnValue({ order: mockOrder });

    // Tentar abater R$ 40 em uma nova compra
    const success = await repository.consumeCashbackFIFO(tenantId, clientId, 40, orderId);

    expect(success).toBe(true);
    expect(mockOrder).toHaveBeenCalledWith('expires_at', { ascending: true });
  });

  test('Não deve falhar ou tentar gravar campos inexistentes no schema do Supabase ao atualizar o ledger', async () => {
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });
    
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ id: 'ledger-1', remaining_amount: 20, status: 'ATIVO' }],
        error: null
      }),
      update: mockUpdate
    });

    await repository.consumeCashbackFIFO('t1', 'c1', 10, 'o1');

    // Garante que o update enviou apenas remaining_amount sem used_on_order_id nem used_at
    expect(mockUpdate).toHaveBeenCalledWith({
      remaining_amount: 10
    });
  });
});
