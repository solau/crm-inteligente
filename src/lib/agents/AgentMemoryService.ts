// src/lib/agents/AgentMemoryService.ts
// Gerenciamento de Memória Histórica dos Agentes para Aprendizado Contínuo

export interface AgentScanResult {
  timestamp: string;
  globalHealthScore: number;
  routines: {
    score: number;
    blingSyncStatus: string;
    cashbackCronStatus: string;
    whatsappWebhookStatus: string;
    databaseLatencyMs: number;
    items: Array<{ name: string; status: 'ok' | 'warning' | 'error'; responseTimeMs: number; details: string }>;
  };
  rules: {
    score: number;
    cashbackRuleStatus: 'pass' | 'warning' | 'error';
    conversionRuleStatus: 'pass' | 'warning' | 'error';
    messageRuleStatus: 'pass' | 'warning' | 'error';
    violations: Array<{ rule: string; severity: 'low' | 'medium' | 'high'; description: string; count: number }>;
  };
  business: {
    score: number;
    topProducts: Array<{ name: string; salesCount: number; totalRevenue: number }>;
    criticalStockItems: Array<{ name: string; currentStock: number; estimatedDaysLeft: number; suggestedReorderQty: number }>;
    messageConversions: Array<{ campaign: string; totalSent: number; totalConversions: number; conversionRate: number; totalRevenue: number }>;
    periodComparison: { currentSalesTotal: number; previousSalesTotal: number; growthPercentage: number; avgTicket: number };
    aiRecommendations: {
      storeImprovements: string[];
      salesImprovements: string[];
      purchasingImprovements: string[];
      historicalInsight: string;
    };
  };
  bugs: {
    score: number;
    errorCount: number;
    issues: Array<{ id: string; file: string; line?: number; severity: 'high' | 'medium' | 'low'; description: string; suggestion: string }>;
  };
}

// Em memória / Cache local persistente para armazenar diagnósticos
let memoryCache: AgentScanResult[] = [];

export class AgentMemoryService {
  static getLatestScan(): AgentScanResult | null {
    if (memoryCache.length === 0) return null;
    return memoryCache[memoryCache.length - 1];
  }

  static getScanHistory(limit = 10): AgentScanResult[] {
    return memoryCache.slice(-limit);
  }

  static saveScan(scan: AgentScanResult): void {
    memoryCache.push(scan);
    // Limita o histórico em memória a 50 execuções
    if (memoryCache.length > 50) {
      memoryCache = memoryCache.slice(-50);
    }
  }

  static getEvolutionSummary(): string {
    if (memoryCache.length < 2) {
      return "Primeira varredura registrada. O histórico de aprendizado do negócio começará a comparar o desempenho a partir das próximas execuções.";
    }
    const latest = memoryCache[memoryCache.length - 1];
    const previous = memoryCache[memoryCache.length - 2];
    const scoreDiff = latest.globalHealthScore - previous.globalHealthScore;
    const revDiff = latest.business.periodComparison.currentSalesTotal - previous.business.periodComparison.currentSalesTotal;

    const diffText = scoreDiff >= 0 ? `+${scoreDiff}%` : `${scoreDiff}%`;
    const revText = revDiff >= 0 ? `+R$ ${revDiff.toFixed(2)}` : `-R$ ${Math.abs(revDiff).toFixed(2)}`;

    return `Comparado à execução anterior de ${new Date(previous.timestamp).toLocaleString('pt-BR')}: A saúde do sistema variou em ${diffText} e a tendência de faturamento variou em ${revText}.`;
  }
}
