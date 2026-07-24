import { ClientRepository } from '../../infrastructure/repositories/ClientRepository';
import { KanbanRepository } from '../../infrastructure/repositories/KanbanRepository';
import { CashbackRepository } from '../../infrastructure/repositories/CashbackRepository';
import { GeminiService } from '../../services/GeminiService';
import { BlingProvider } from '../../infrastructure/providers/BlingProvider';
import { InteractionRepository } from '../../infrastructure/repositories/InteractionRepository';

export class ProcessBlingWebhookUseCase {
  constructor(
    private clientRepository: ClientRepository,
    private kanbanRepository: KanbanRepository,
    private geminiService: GeminiService,
    private cashbackRepository: CashbackRepository,
    private blingProvider: BlingProvider,
    private interactionRepository: InteractionRepository
  ) {}

  async execute(payload: any, tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38'): Promise<boolean> {
    // Identifica o ID do pedido dependendo se é payload V3 ou V2
    const rawOrderId = payload?.data?.id || payload?.retorno?.pedidos?.[0]?.pedido?.id || payload?.pedido?.numero || payload?.pedido?.id;
    if (!rawOrderId) {
      console.log('Webhook Abortado: Payload não contém ID de pedido.', JSON.stringify(payload));
      return true;
    }

    // Busca o detalhe COMPLETO da nota no Bling
    const fullOrder = await this.blingProvider.getOrderById(rawOrderId.toString());
    if (!fullOrder) {
      console.log(`Webhook Abortado: Não foi possível baixar os detalhes do pedido ${rawOrderId}.`);
      return true;
    }

    const nomeCliente = fullOrder.contato?.nome || payload?.pedido?.cliente?.nome || 'Cliente Alpha';
    let foneClienteReal = fullOrder.contato?.celular || fullOrder.contato?.telefone || payload?.pedido?.cliente?.fone;

    if (!foneClienteReal && fullOrder.contato?.id) {
      console.log(`Telefone não encontrado no pedido. Buscando cadastro do contato ${fullOrder.contato.id} no Bling...`);
      const contatoBling = await this.blingProvider.getContactById(fullOrder.contato.id.toString());
      if (contatoBling) {
        foneClienteReal = contatoBling.celular || contatoBling.telefone;
      }
    }

    if (foneClienteReal) {
      foneClienteReal = foneClienteReal.replace(/\D/g, '');
    }
    
    const isSemTelefone = !foneClienteReal;
    const isConsumidorFinal = nomeCliente.toLowerCase().includes('consumidor final');
    
    const totalVenda = Number(fullOrder.total) || payload?.pedido?.total || 0;
    const orderId = fullOrder.id?.toString() || rawOrderId.toString();

    // Matemática Exata do Desconto e Valor Pago
    const totalProdutos = Number(fullOrder.totalProdutos) || 0;
    const frete = Number(fullOrder.transporte?.frete) || 0;
    const outrasDespesas = Number(fullOrder.outrasDespesas) || 0;
    const descontoOficial = Number(fullOrder.desconto?.valor) || Number(payload?.pedido?.desconto) || 0;
    
    const valorBruto = totalProdutos + frete + outrasDespesas;
    
    let descontoAplicadoCalculado = 0;
    
    // Se o totalVenda que veio do Bling ainda estiver cheio (igual ao bruto), 
    // mas houver um desconto preenchido no campo oficial, usamos ele.
    if (totalVenda >= valorBruto && descontoOficial > 0) {
      descontoAplicadoCalculado = descontoOficial;
    } else if (valorBruto > totalVenda) {
      // Se o totalVenda for menor que o bruto, significa que o Bling já subtraiu o desconto no total
      descontoAplicadoCalculado = valorBruto - totalVenda;
    }
    
    const descontoAplicado = descontoAplicadoCalculado > 0 ? Number(descontoAplicadoCalculado.toFixed(2)) : 0;
    
    // O Valor Real Pago é sempre o Bruto menos qualquer desconto detectado
    const valorPagoReal = valorBruto - descontoAplicado;

    // 1. Tratamento de Alertas Críticos (Sem Telefone ou Consumidor Final)
    if (isSemTelefone || isConsumidorFinal) {
      let systemClient = await this.clientRepository.getClientByPhone('00000000000');
      if (!systemClient) {
        systemClient = await this.clientRepository.upsertClientByPhone({
          name: '⚠️ ALERTAS DO SISTEMA',
          phone: '00000000000',
          cashback_balance: 0,
          lead_score: 0,
          tenant_id: tenantId,
          last_purchase_date: undefined,
          total_spent: 0,
          base_lead_score: 0
        });
      }

      const alertColumnId = await this.kanbanRepository.getOrCreateColumn('🚨 Alertas Gerenciais', 1);
      
      let msgAlerta = `Pedido ${orderId} (R$ ${valorPagoReal}): `;
      if (isSemTelefone) msgAlerta += 'Cliente SEM TELEFONE! ';
      if (isConsumidorFinal) msgAlerta += 'Venda como Consumidor Final! ';

      await this.kanbanRepository.createDeal(
        systemClient.id!,
        alertColumnId,
        msgAlerta,
        valorPagoReal
      );

      // Se não tem telefone, é impossível fidelizar. Aborta o webhook aqui.
      if (isSemTelefone) {
        console.log(`Webhook Abortado: Pedido ${orderId} sem telefone, mas alerta gerado.`);
        return true;
      }
    }

    // 2. Busca ou Cria Cliente Real
    let cliente = await this.clientRepository.getClientByPhone(foneClienteReal!);
    
    if (!cliente) {
      cliente = await this.clientRepository.upsertClientByPhone({
        name: nomeCliente,
        phone: foneClienteReal!,
        bling_id: fullOrder.contato?.id?.toString() || payload?.pedido?.cliente?.id?.toString(),
        cashback_balance: 0,
        lead_score: 0,
        tenant_id: tenantId,
        last_purchase_date: undefined,
        total_spent: 0,
        base_lead_score: 0
      });
    }

    const situacaoId = Number(fullOrder.situacao?.id) || Number(payload?.pedido?.situacao?.id) || 0;

    // Regra de Cancelamento: Revoga o cashback gerado
    if (situacaoId === 12) {
      await this.cashbackRepository.revokeCashback(tenantId, cliente.id!, orderId);
      const novoSaldoAtivo = await this.cashbackRepository.getActiveBalance(tenantId, cliente.id!);
      await this.clientRepository.updateClient(cliente.id!, { cashback_balance: novoSaldoAtivo });
      return true;
    }

    // Ignora qualquer outro status que não seja Válido para Cashback:
    // 6 = Em aberto, 9 = Atendido, 15 = Em andamento, 24 = Verificado
    if (![6, 9, 15, 24].includes(situacaoId)) {
      return true;
    }

    // 5. Atribuição de Conversão (Tracking) ANTECIPADA
    // Data exata em que o pedido foi criado no Bling, ou a data atual
    let saleDateStr = new Date().toISOString();
    if (fullOrder.data) {
      saleDateStr = `${fullOrder.data}T23:59:59.999Z`;
    }

    if (this.interactionRepository) {
      const attributionExists = await this.interactionRepository.checkAttributionExists(orderId);
      if (!attributionExists) {
        const lastInteraction = await this.interactionRepository.getLatestInteraction(cliente.id!, saleDateStr);
        // Atribui se a interação ocorreu nos últimos 15 dias
        if (lastInteraction) {
          await this.interactionRepository.attributeSale(
            tenantId,
            lastInteraction.id,
            orderId,
            valorPagoReal,
            saleDateStr
          );
        }
      }
    }

    // Validação de Idempotência: Checa se este pedido já gerou cashback/RFM
    const orderAlreadyProcessed = await this.cashbackRepository.checkOrderExists(orderId);
    if (orderAlreadyProcessed) {
      console.log(`Webhook Abortado: Pedido ${orderId} já processado anteriormente.`);
      return true;
    }

    // 2. Regra de Negócio: Inteligência de Cashback (LEDGER + FIFO + CAPPING)
    
    // Capping: Se o desconto for maior que 20%, gera alerta de violação e limita o consumo do cashback
    let descontoParaAbater = descontoAplicado;
    const limiteCapping = valorBruto * 0.20;
    
    if (descontoAplicado > limiteCapping) {
      // Gera Alerta no Banco
      await this.cashbackRepository.createAlert(
        tenantId, 
        cliente.id!, 
        orderId, 
        'CAPPING_VIOLATION', 
        `Desconto de R$ ${descontoAplicado} excedeu o limite de 20% (R$ ${limiteCapping})`
      );

      // Gera Alerta Visual no Kanban
      const alertColumnId = await this.kanbanRepository.getOrCreateColumn('🚨 Auditoria de Descontos', 1);
      await this.kanbanRepository.createDeal(
        cliente.id!,
        alertColumnId,
        `ALERTA: Desconto abusivo de R$ ${descontoAplicado} (Acima de 20%)`,
        valorPagoReal
      );
    }

    // Consome saldo FIFO do Ledger se houve desconto
    if (descontoParaAbater > 0) {
      await this.cashbackRepository.consumeCashbackFIFO(tenantId, cliente.id!, descontoParaAbater, orderId);
    }

    // Gera o novo Cashback com Carência (Status PENDENTE, ativa em 1 dia, expira em 45)
    const valorGerado = valorPagoReal * 0.10;
    const saleDate = new Date(saleDateStr);
    const activeAt = new Date(saleDate);
    activeAt.setDate(activeAt.getDate() + 1); // Alterado de 7 para 1
    const expiresAt = new Date(saleDate);
    expiresAt.setDate(expiresAt.getDate() + 45);

    await this.cashbackRepository.addCashback({
      tenant_id: tenantId,
      client_id: cliente.id!,
      order_id: orderId,
      original_amount: valorGerado,
      remaining_amount: valorGerado,
      status: 'PENDENTE',
      active_at: activeAt.toISOString(),
      expires_at: expiresAt.toISOString()
    });

    // Atualiza a coluna cacheada de cashback do cliente baseada na soma real dos Ativos
    const saldoRealAtivo = await this.cashbackRepository.getActiveBalance(tenantId, cliente.id!);
    
    // Atualização de RFM Base (Recência, Frequência, Valor)
    const novoTotalGasto = (Number(cliente.total_spent) || 0) + valorPagoReal;
    
    // Cálculo do RFM Base (O Decay roda via Cron)
    let baseRFM = (cliente.base_lead_score || 0) + 10 + Math.floor(valorPagoReal / 100);
    baseRFM = Math.min(100, baseRFM);
    const novoLeadScore = baseRFM; // O score visível será igual ao base (Decay = 0) pois acabou de comprar

    await this.clientRepository.updateClient(cliente.id!, {
      cashback_balance: saldoRealAtivo,
      lead_score: novoLeadScore,
      base_lead_score: baseRFM,
      total_spent: novoTotalGasto,
      last_purchase_date: saleDateStr
    });

    // 3. Regra de Negócio AI: Processa Preferências do Cliente
    const itensVendidos = fullOrder.itens || payload?.pedido?.itens || [];
    if (itensVendidos.length > 0) {
      try {
        const produtosFormatados = itensVendidos.map((i: any) => ({ 
          descricao: i.item?.descricao || i.descricao, 
          quantidade: i.item?.quantidade || i.quantidade 
        }));
        
        const novasPreferencias = await this.geminiService.analyzePreferences(
          cliente.preferences, 
          produtosFormatados
        );
        
        await this.clientRepository.updateClient(cliente.id!, {
          preferences: novasPreferencias
        });
      } catch (error) {
        console.error('Erro ao analisar preferências com Gemini:', error);
        // Não aborta o webhook se a IA falhar, as outras regras críticas já rodaram
      }
    }

    // 4. Regra de Negócio: Kanban Pós-venda (Move o cliente para a coluna Pós-Venda)
    const columnId = await this.kanbanRepository.getOrCreateColumn('Pós-Venda', 99);
    await this.kanbanRepository.moveOrCreatePostSalesDeal(
      cliente.id!, 
      columnId, 
      'Acompanhamento Pós-Venda (Qualidade)', 
      valorPagoReal
    );



    return true;
  }
}
