// src/lib/agents/BugHunterAgent.ts
// Agente Caçador de Bugs e Auditagem de Exceções de Código/Logs

import fs from 'fs';
import path from 'path';

export interface BugReport {
  score: number;
  errorCount: number;
  issues: Array<{ id: string; file: string; line?: number; severity: 'high' | 'medium' | 'low'; description: string; suggestion: string }>;
}

export class BugHunterAgent {
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  async runDiagnostic(): Promise<BugReport> {
    const issues: Array<{ id: string; file: string; line?: number; severity: 'high' | 'medium' | 'low'; description: string; suggestion: string }> = [];

    // 1. Verificação de arquivos de código conhecidos com potenciais catches silenciosos ou falta de fallback
    const targetFiles = [
      'src/app/api/auth/bling/callback/route.ts',
      'src/app/api/clientes/[id]/dossie/route.ts',
      'src/app/api/clientes/[id]/sync/route.ts',
      'src/app/api/cron/cashback/route.ts',
      'src/app/api/sync/route.ts',
      'src/app/api/webhooks/bling/route.ts',
      'src/app/api/webhooks/whatsapp/route.ts'
    ];

    let issueIdCounter = 1;

    for (const relFile of targetFiles) {
      const fullPath = path.join(this.workspaceRoot, relFile);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (line.includes('process.env.') && !line.includes('||') && !line.includes('??') && !line.includes('process.env.GEMINI_API_KEY')) {
              if (line.includes('const ') || line.includes('let ')) {
                issues.push({
                  id: `BUG-${issueIdCounter++}`,
                  file: relFile,
                  line: index + 1,
                  severity: 'medium',
                  description: 'Acesso direto a variável de ambiente sem fallback de segurança.',
                  suggestion: 'Adicionar operador fallback (ex: process.env.VAR || "").'
                });
              }
            }

            if (line.trim() === '} catch (error) {' || line.trim() === '} catch (error: any) {' || line.trim() === '} catch (e) {') {
              // Checa se a próxima linha está vazia ou apenas fecha
              const nextLine = lines[index + 1] ? lines[index + 1].trim() : '';
              if (nextLine === '}' || nextLine === '') {
                issues.push({
                  id: `BUG-${issueIdCounter++}`,
                  file: relFile,
                  line: index + 1,
                  severity: 'high',
                  description: 'Bloco de tratamento de erro silencioso (catch vazio).',
                  suggestion: 'Registrar o erro via console.error ou lançar resposta HTTP estruturada.'
                });
              }
            }
          });
        } catch (e) {
          // Ignora leitura
        }
      }
    }

    // Se não encontrou novos erros graves, mantém status limpo com lembretes preventivos
    if (issues.length === 0) {
      issues.push({
        id: 'INFO-01',
        file: 'src/lib/services/GeminiService.ts',
        line: 12,
        severity: 'low',
        description: 'Verificação preventiva de Chave de API Gemini.',
        suggestion: 'Certifique-se de que GEMINI_API_KEY está presente no .env.local.'
      });
    }

    const highSeverity = issues.filter(i => i.severity === 'high').length;
    const medSeverity = issues.filter(i => i.severity === 'medium').length;

    let score = 100 - (highSeverity * 20) - (medSeverity * 10);
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      errorCount: issues.length,
      issues
    };
  }
}
