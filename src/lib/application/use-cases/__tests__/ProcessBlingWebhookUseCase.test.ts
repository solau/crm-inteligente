import { ProcessBlingWebhookUseCase, WebhookPayload } from '../ProcessBlingWebhookUseCase';
import { GeminiService } from '../../../services/GeminiService';
import { CashbackRepository } from '../../repositories/CashbackRepository';

describe('ProcessBlingWebhookUseCase', () => {
  let useCase: ProcessBlingWebhookUseCase;
  let mockClientRepo: any;
  let mockKanbanRepo: any;
  let mockCashbackRepo: any;
  let mockGeminiService: jest.Mocked<GeminiService>;

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

    useCase = new ProcessBlingWebhookUseCase(
      mockClientRepo, 
      mockKanbanRepo, 
      mockGeminiService,
      mockCashbackRepo
    );
  });

  it('deve consumir cashback do Ledger via FIFO se houver desconto', async () => {
    const clienteExistente = { id: 'client-1', cashback_balance: 100, lead_score: 50 };
    mockClientRepo.getClientByPhone.mockResolvedValue(clienteExistente);
    mockCashbackRepo.getActiveBalance.mockResolvedValue(50); // Simula o saldo após consumir

    const payload: WebhookPayload = {
      tipo: 'pedido.faturado',
      pedido: {
        cliente: { nome: 'Jorge', fone: '11999999999' },
        total: 500,
        desconto: 50, // 10% de desconto
      },
    };

    await useCase.execute(payload);

    expect(mockCashbackRepo.consumeCashbackFIFO).toHaveBeenCalledWith(
      'd948b6cc-cc2c-4399-8525-02f17f281d38', 
      'client-1', 
      50
    );
    expect(mockClientRepo.updateClient).toHaveBeenCalledWith('client-1', {
      cashback_balance: 50,
      lead_score: 60,
    });
  });

  it('deve gerar alerta de CAPPING_VIOLATION se o desconto for maior que 20% do pedido', async () => {
    const clienteExistente = { id: 'client-10', cashback_balance: 0, lead_score: 10 };
    mockClientRepo.getClientByPhone.mockResolvedValue(clienteExistente);

    const payload: WebhookPayload = {
      tipo: 'pedido.faturado',
      pedido: {
        numero: '1234',
        cliente: { nome: 'João', fone: '11911111111' },
        total: 1000,
        desconto: 250, // 25% de desconto
      },
    };

    await useCase.execute(payload);

    expect(mockCashbackRepo.createAlert).toHaveBeenCalledWith(
      'd948b6cc-cc2c-4399-8525-02f17f281d38',
      'client-10',
      '1234',
      'CAPPING_VIOLATION',
      'Desconto de R$ 250 excedeu o limite de 20% (R$ 200)'
    );

    expect(mockKanbanRepo.getOrCreateColumn).toHaveBeenCalledWith('🚨 Alertas Gerenciais', 1);
  });

  it('deve criar um cashback PENDENTE (Carência) a cada nova compra', async () => {
    const clienteExistente = { id: 'client-2', cashback_balance: 100, lead_score: 95 };
    mockClientRepo.getClientByPhone.mockResolvedValue(clienteExistente);
    mockCashbackRepo.getActiveBalance.mockResolvedValue(200);

    const payload: WebhookPayload = {
      tipo: 'pedido.faturado',
      pedido: {
        cliente: { nome: 'Maria', fone: '11988888888' },
        total: 1000,
        desconto: 0,
      },
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
