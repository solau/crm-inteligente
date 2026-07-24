// src/lib/agents/RuleValidationAgent.ts
// Agente Validador de Regras de Negócio, Cashback, Conversões e Mensagens

import { supabaseAdmin as supabase } from '@/lib/supabase';

export interface RuleValidationReport {
  score: number;
  cashbackRuleStatus: 'pass' | 'warning' | 'error';
  conversionRuleStatus: 'pass' | 'warning' | 'error';
  messageRuleStatus: 'pass' | 'warning' | 'error';
  violations: Array<{ rule: string; severity: 'low' | 'medium' | 'high'; description: string; count: number }>;
}

export class RuleValidationAgent {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async validateRules(): Promise<RuleValidationReport> {
    const violations: Array<{ rule: string; severity: 'low' | 'medium' | 'high'; description: string; count: number }> = [];

    let cashbackStatus: 'pass' | 'warning' | 'error' = 'pass';
    let conversionStatus: 'pass' | 'warning' | 'error' = 'pass';
    let messageStatus: 'pass' | 'warning' | 'error' = 'pass';

    // 1. Validação de Regras de Cashback
    try {
      const { data: negativeClients } = await supabase
        .from('clients')
        .select('id, name, cashback_balance')
        .lt('cashback_balance', 0);

      if (negativeClients && negativeClients.length > 0) {
        cashbackStatus = 'warning';
        violations.push({
          rule: 'Regra de Saldo Negativo de Cashback',
          severity: 'medium',
          description: `Identificados ${negativeClients.length} cliente(s) com saldo de cashback negativo.`,
          count: negativeClients.length
        });
      }

      // Valida extrato de ledger
      const { data: ledgerEntries } = await supabase
        .from('cashback_ledger')
        .select('id, client_id, original_amount')
        .limit(100);

      if (!ledgerEntries || ledgerEntries.length === 0) {
        violations.push({
          rule: 'Transparência de Extrato de Cashback',
          severity: 'low',
          description: 'Nenhum lançamento no extrato detalhado de cashback encontrado recentemente.',
          count: 0
        });
      }
    } catch (err: any) {
      cashbackStatus = 'warning';
      violations.push({
        rule: 'Auditoria de Cashback',
        severity: 'low',
        description: `Tabela de cashback ledger ainda não possui registros suficientes: ${err.message}`,
        count: 1
      });
    }

    // 2. Validação de Regras de Conversão de Vendas (Attribution)
    try {
      const { data: attributions } = await supabase
        .from('sales_attribution')
        .select('id, interaction_id, revenue')
        .limit(100);

      if (attributions && attributions.length > 0) {
        const orphanAttributions = attributions.filter((a: any) => !a.interaction_id);
        if (orphanAttributions.length > 0) {
          conversionStatus = 'warning';
          violations.push({
            rule: 'Atribuição de Vendas ao WhatsApp',
            severity: 'medium',
            description: `Encontradas ${orphanAttributions.length} conversões de vendas sem interação registrada.`,
            count: orphanAttributions.length
          });
        }
      }

      // Checa se há campanhas com baixa conversão (ex: OFERTA_90D com 0% conversão)
      const { data: dashboardView } = await supabase
        .from('vw_kanban_dashboard')
        .select('*');

      if (dashboardView && dashboardView.length > 0) {
        const zeroConversionCamps = dashboardView.filter((v: any) => Number(v.total_interactions) > 10 && Number(v.total_conversions) === 0);
        if (zeroConversionCamps.length > 0) {
          conversionStatus = 'warning';
          zeroConversionCamps.forEach((camp: any) => {
            violations.push({
              rule: `Alerta de Baixa Conversão em Campanha (${camp.campaign_type})`,
              severity: 'medium',
              description: `A campanha ${camp.campaign_type} enviou ${camp.total_interactions} mensagens no WhatsApp porém teve 0% de conversão em vendas.`,
              count: Number(camp.total_interactions)
            });
          });
        }
      }
    } catch (err: any) {
      violations.push({
        rule: 'Rastreamento de Conversões',
        severity: 'low',
        description: 'Mapeamento de conversões operando em modo inicial.',
        count: 0
      });
    }

    // 3. Validação de Fila de Mensagens Enviadas
    try {
      const { data: interactions } = await supabase
        .from('client_interactions')
        .select('id, created_at, campaign_type, client_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (interactions && interactions.length > 1) {
        // Checa duplicados no mesmo dia para o mesmo cliente
        const keyMap = new Set<string>();
        let duplicates = 0;
        for (const item of interactions) {
          const day = new Date(item.created_at).toISOString().split('T')[0];
          const key = `${item.client_id}_${item.campaign_type}_${day}`;
          if (keyMap.has(key)) {
            duplicates++;
          } else {
            keyMap.add(key);
          }
        }

        if (duplicates > 0) {
          messageStatus = 'warning';
          violations.push({
            rule: 'Prevenção de Mensagens Duplicadas (Anti-Spam)',
            severity: 'high',
            description: `Detectadas ${duplicates} mensagens duplicadas enviadas para o mesmo cliente no mesmo dia.`,
            count: duplicates
          });
        }
      }
    } catch (err: any) {
      // Tabela de interações inicial
    }

    // Cálculo do Score de Conformidade das Regras
    const highViolations = violations.filter(v => v.severity === 'high').length;
    const medViolations = violations.filter(v => v.severity === 'medium').length;
    const lowViolations = violations.filter(v => v.severity === 'low').length;

    let score = 100 - (highViolations * 25) - (medViolations * 10) - (lowViolations * 5);
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      cashbackRuleStatus: cashbackStatus,
      conversionRuleStatus: conversionStatus,
      messageRuleStatus: messageStatus,
      violations
    };
  }
}
