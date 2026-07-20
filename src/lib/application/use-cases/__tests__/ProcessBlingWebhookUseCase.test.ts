import { ProcessBlingWebhookUseCase } from '../ProcessBlingWebhookUseCase';
import { GeminiService } from '../../../services/GeminiService';

describe('ProcessBlingWebhookUseCase', () => {
  let useCase: ProcessBlingWebhookUseCase;
  let mockClientRepo: any;
  let mockKanbanRepo: any;
  let mockCashbackRepo: any;
  let mockGeminiService: jest.Mocked<GeminiService>;
  let mockBlingProvider: any;
  let mockInteractionRepo: any;

  beforeEach(() => {
    mockClientRepo = {
      getClientByPhone: jest.fn(),
      upsertClientByPhone: jest.fn(),
      updateClient: jest.fn(),
    };

    mockKanbanRepo = {
      getOrCreateColumn: jest.fn().mockResolvedValue('col-123'),
      createDeal: jest.fn(),
    };

    mockCashbackRepo = {
      addCashback: jest.fn(),
      consumeCashbackFIFO: jest.fn().mockResolvedValue(true),
      getActiveBalance: jest.fn().mockResolvedValue(100),
      createAlert: jest.fn(),
    };

    mockGeminiService = {
      analyzePreferences: jest.fn().mockResolvedValue('Mock Preferências'),
    } as any;

    mockInteractionRepo = {
      attributeSale: jest.fn(),
    };

    mockBlingProvider = {
      getOrderById: jest.fn().mockResolvedValue({
        id: 'order-123',
        numero: '123',
        total: 100,
        situacao: { id: 9 },
        contato: { id: 456 }
      }),
      getContactById: jest.fn().mockResolvedValue({
        celular: '71991881690'
      })
    } as any;

    useCase = new ProcessBlingWebhookUseCase(
      mockClientRepo, 
      mockKanbanRepo, 
      mockGeminiService,
      mockCashbackRepo,
      mockBlingProvider,
      mockInteractionRepo
    );
  });

  it('deve consumir cashback do Ledger via FIFO se houver desconto', async () => {
    const clienteExistente = { id: 'client-1', cashback_balance: 100, lead_score: 50 };
    mockClientRepo.getClientByPhone.mockResolvedValue(clienteExistente);
    mockCashbackRepo.getActiveBalance.mockResolvedValue(50); // Simula o saldo após consumir

    mockBlingProvider.getOrderById.mockResolvedValue({
      id: 'order-123',
      numero: '123',
      total: 450, // 500 total - 50 desconto
      totalProdutos: 500,
      transporte: { frete: 0 },
      outrasDespesas: 0,
      situacao: { id: 9 },
      contato: { id: 456 }
    });

    const payload: any = {
      data: { id: 'order-123' }
    };

    await useCase.execute(payload);

    expect(mockCashbackRepo.consumeCashbackFIFO).toHaveBeenCalledWith(
      'd948b6cc-cc2c-4399-8525-02f17f281d38', 
      'client-1', 
      50,
      'order-123'
    );
    expect(mockClientRepo.updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      cashback_balance: 50,
      lead_score: expect.any(Number),
      total_spent: 450
    }));
  });

  it('deve gerar alerta de CAPPING_VIOLATION se o desconto for maior que 20% do pedido', async () => {
    const clienteExistente = { id: 'client-10', cashback_balance: 0, lead_score: 10 };
    mockClientRepo.getClientByPhone.mockResolvedValue(clienteExistente);

    mockBlingProvider.getOrderById.mockResolvedValue({
      id: 'order-1234',
      numero: '1234',
      total: 750, // 1000 - 250 desconto (25%)
      totalProdutos: 1000,
      transporte: { frete: 0 },
      outrasDespesas: 0,
      situacao: { id: 9 },
      contato: { id: 456 }
    });

    const payload: any = {
      data: { id: 'order-1234' }
    };

    await useCase.execute(payload);

    expect(mockCashbackRepo.createAlert).toHaveBeenCalledWith(
      'd948b6cc-cc2c-4399-8525-02f17f281d38',
      'client-10',
      'order-1234',
      'CAPPING_VIOLATION',
      'Desconto de R$ 250 excedeu o limite de 20% (R$ 150)'
    );

    expect(mockKanbanRepo.getOrCreateColumn).toHaveBeenCalledWith('🚨 Alertas Gerenciais', 1);
  });

  it('deve criar um cashback PENDENTE (Carência) a cada nova compra', async () => {
    const clienteExistente = { id: 'client-2', cashback_balance: 100, lead_score: 95 };
    mockClientRepo.getClientByPhone.mockResolvedValue(clienteExistente);
    mockCashbackRepo.getActiveBalance.mockResolvedValue(200);

    mockBlingProvider.getOrderById.mockResolvedValue({
      id: 'order-123',
      numero: '123',
      total: 1000,
      totalProdutos: 1000,
      transporte: { frete: 0 },
      outrasDespesas: 0,
      situacao: { id: 9 },
      contato: { id: 456 }
    });

    const payload: any = {
      data: { id: 'order-123' }
    };

    await useCase.execute(payload);

    expect(mockCashbackRepo.addCashback).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-2',
        original_amount: 100, // 10% de 1000
        remaining_amount: 100,
        status: 'PENDENTE'
      })
    );
  });
});
