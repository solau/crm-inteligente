const fs = require('fs');
const path = require('path');

// Require all agents
const LogAnalyzerAgent = require('./agents/LogAnalyzerAgent');
const BugHunterAgent = require('./agents/BugHunterAgent');
const ArchitectureAuditorAgent = require('./agents/ArchitectureAuditorAgent');
const TestCrafterAgent = require('./agents/TestCrafterAgent');
const FeatureSanityAgent = require('./agents/FeatureSanityAgent');
const FeatureInnovatorAgent = require('./agents/FeatureInnovatorAgent');

async function runOrchestrator() {
  console.log('=====================================================');
  console.log('🤖 INICIANDO ORQUESTRADOR DE AGENTES DE DESENVOLVIMENTO');
  console.log('=====================================================');

  const agents = [
    new FeatureSanityAgent(),
    new LogAnalyzerAgent(),
    new BugHunterAgent(),
    new ArchitectureAuditorAgent(),
    new TestCrafterAgent(),
    new FeatureInnovatorAgent()
  ];

  const results = {};

  for (const agent of agents) {
    try {
      results[agent.name] = await agent.execute();
    } catch (e) {
      console.error(`Erro ao executar agente ${agent.name}:`, e);
      results[agent.name] = [{
        type: 'ERROR',
        title: `Falha na execução do agente ${agent.name}`,
        content: `Exceção capturada: ${e.message}`
      }];
    }
  }

  // Compile to DEV_INSIGHTS.md
  const reportPath = path.join(__dirname, '../DEV_INSIGHTS.md');
  const now = new Date().toLocaleString('pt-BR');

  let mdContent = `# Relatório de Insights e Diagnóstico Inteligente (Multi-Agente)
*Gerado em: ${now}*

Este relatório compila as varreduras, auditorias e análises realizadas pela suíte de **Agentes de Desenvolvimento** locais na base de código do CRM Inteligente.

---

`;

  // Helper to get status emoji
  const getEmoji = (type) => {
    switch (type) {
      case 'SUCCESS': return '🟢 [OK]';
      case 'ALERT':
      case 'ERROR': return '🔴 [ALERTA]';
      case 'WARNING':
      case 'RECOMMENDATION': return '🟡 [ATENÇÃO]';
      case 'OPPORTUNITY': return '💡 [OPORTUNIDADE]';
      default: return 'ℹ️ [INFO]';
    }
  };

  // Section mapping
  const sectionMapping = {
    FeatureSanityAgent: '🚀 Saúde do Sistema & Testes de Sanidade',
    LogAnalyzerAgent: '🔍 Análise de Logs de Execução',
    BugHunterAgent: '🐛 Caça a Bugs Lógicos e Concorrência',
    ArchitectureAuditorAgent: '📐 Auditoria de Arquitetura e SOLID',
    TestCrafterAgent: '🧪 Cobertura de Testes (TDD)',
    FeatureInnovatorAgent: '💡 Propostas de Inovação de Negócio'
  };

  for (const [agentName, title] of Object.entries(sectionMapping)) {
    const insights = results[agentName] || [];
    mdContent += `## ${title}\n\n`;
    
    if (insights.length === 0) {
      mdContent += `*Nenhum relatório emitido por este agente.*\n\n`;
    } else {
      insights.forEach(insight => {
        mdContent += `### ${getEmoji(insight.type)} ${insight.title}\n`;
        mdContent += `${insight.content}\n\n`;
      });
    }
    mdContent += `---\n\n`;
  }

  mdContent += `\n*Fim do Relatório. Para re-executar os diagnósticos, rode \`npm run dev-agents\` no seu terminal.*`;

  fs.writeFileSync(reportPath, mdContent, 'utf8');

  console.log('=====================================================');
  console.log('✓ RELATÓRIO COMPILADO COM SUCESSO EM: DEV_INSIGHTS.md');
  console.log('=====================================================');
}

runOrchestrator();
