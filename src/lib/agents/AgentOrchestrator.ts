// src/lib/agents/AgentOrchestrator.ts
// Orquestrador Central Multi-Agentes do CRM Inteligente

import { RoutineHealthAgent } from './RoutineHealthAgent';
import { RuleValidationAgent } from './RuleValidationAgent';
import { BusinessIntelligenceAgent } from './BusinessIntelligenceAgent';
import { BugHunterAgent } from './BugHunterAgent';
import { AgentMemoryService, AgentScanResult } from './AgentMemoryService';

export class AgentOrchestrator {
  private tenantId: string;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
  }

  async executeFullDiagnostic(baseUrl?: string): Promise<AgentScanResult> {
    const routineAgent = new RoutineHealthAgent(this.tenantId);
    const ruleAgent = new RuleValidationAgent(this.tenantId);
    const businessAgent = new BusinessIntelligenceAgent(this.tenantId);
    const bugAgent = new BugHunterAgent();

    // Execução paralela dos 4 agentes especialistas
    const [routineReport, ruleReport, businessReport, bugReport] = await Promise.all([
      routineAgent.runDiagnostic(baseUrl),
      ruleAgent.validateRules(),
      businessAgent.runAnalysis(),
      bugAgent.runDiagnostic()
    ]);

    // Cálculo do Score Geral do Sistema (Média ponderada)
    const globalHealthScore = Math.round(
      (routineReport.score * 0.3) +
      (ruleReport.score * 0.25) +
      (businessReport.score * 0.25) +
      (bugReport.score * 0.2)
    );

    const fullResult: AgentScanResult = {
      timestamp: new Date().toISOString(),
      globalHealthScore,
      routines: routineReport,
      rules: ruleReport,
      business: businessReport,
      bugs: bugReport
    };

    // Grava na memória para aprendizado contínuo
    AgentMemoryService.saveScan(fullResult);

    return fullResult;
  }

  async triggerRoutineJobs(): Promise<{ success: boolean; triggeredJobs: string[]; logs: string[] }> {
    const routineAgent = new RoutineHealthAgent(this.tenantId);
    return await routineAgent.triggerJobs();
  }

  async validateBusinessRules() {
    const ruleAgent = new RuleValidationAgent(this.tenantId);
    return await ruleAgent.validateRules();
  }
}
