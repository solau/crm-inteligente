const fs = require('fs');
const path = require('path');

class ArchitectureAuditorAgent {
  constructor() {
    this.name = 'ArchitectureAuditorAgent';
  }

  async execute() {
    console.log(`[${this.name}] Executando auditoria de arquitetura e multi-tenancy...`);
    const insights = [];
    const violations = [];

    const srcDir = path.join(__dirname, '../../src');
    this.scanDirectory(srcDir, violations);

    if (violations.length === 0) {
      insights.push({
        type: 'SUCCESS',
        title: 'Arquitetura em conformidade',
        content: 'Nenhuma violação grave de multi-tenancy (tenant_id) ou injeção inadequada de banco de dados foi encontrada nos locais auditados.'
      });
    } else {
      insights.push({
        type: 'WARNING',
        title: `Identificadas ${violations.length} possíveis quebras de padrão de arquitetura`,
        content: `As seguintes inconsistências com as diretrizes do **AGENTS.md** foram encontradas:\n\n${violations.slice(0, 10).map(v => `- **${v.file} (linha ${v.line})**: ${v.desc} (\`${v.snippet}\`)`).join('\n')}`
      });
    }

    return insights;
  }

  scanDirectory(dir, violations) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath, violations);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        this.auditFile(fullPath, violations);
      }
    }
  }

  auditFile(filePath, violations) {
    const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Rule: Multi-Tenant validation
    // Check if file uses supabase or supabaseAdmin, and ensure "tenant_id" is checked or injected.
    const usesDatabaseDirectly = content.includes('.from(');
    const checksTenantId = content.includes('tenant_id') || content.includes('tenantId');
    const isMigrationOrConfig = filePath.includes('supabase') || filePath.includes('config') || filePath.includes('middleware');
    const isRepository = filePath.includes('Repository.ts');

    if (usesDatabaseDirectly && !checksTenantId && !isMigrationOrConfig) {
      // Find which line uses .from(
      lines.forEach((line, index) => {
        if (line.includes('.from(')) {
          violations.push({
            file: relativePath,
            line: index + 1,
            desc: 'Acesso ao banco sem validação visível de multi-tenant (filtro de tenant_id)',
            snippet: line.trim()
          });
        }
      });
    }

    // SOLID Rule: Files too long (Single Responsibility)
    if (lines.length > 500) {
      violations.push({
        file: relativePath,
        line: 1,
        desc: `Arquivo muito longo (${lines.length} linhas). Pode violar o princípio de Responsabilidade Única (SRP).`,
        snippet: `Total de linhas: ${lines.length}`
      });
    }
  }
}

module.exports = ArchitectureAuditorAgent;
