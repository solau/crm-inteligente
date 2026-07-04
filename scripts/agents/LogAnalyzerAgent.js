const fs = require('fs');
const path = require('path');

class LogAnalyzerAgent {
  constructor() {
    this.name = 'LogAnalyzerAgent';
  }

  async execute() {
    console.log(`[${this.name}] Executando análise de logs...`);
    const insights = [];
    const errorsFound = [];

    // 1. Scan for local workspace log files
    const workspaceRoot = path.join(__dirname, '../../');
    try {
      const files = fs.readdirSync(workspaceRoot);
      const logFiles = files.filter(f => f.endsWith('.log'));
      for (const logFile of logFiles) {
        this.parseLogFile(path.join(workspaceRoot, logFile), errorsFound);
      }
    } catch (e) {
      console.error('Erro ao ler diretório do workspace:', e);
    }

    // 2. Scan for system task log files dynamically
    try {
      const userProfile = process.env.USERPROFILE || process.env.HOME || 'C:/Users/Jorge';
      const brainDir = path.join(userProfile, '.gemini/antigravity-ide/brain');
      if (fs.existsSync(brainDir)) {
        const conversations = fs.readdirSync(brainDir);
        for (const convId of conversations) {
          const tasksDir = path.join(brainDir, convId, '.system_generated/tasks');
          if (fs.existsSync(tasksDir)) {
            const taskLogs = fs.readdirSync(tasksDir).filter(f => f.endsWith('.log'));
            for (const logFile of taskLogs) {
              this.parseLogFile(path.join(tasksDir, logFile), errorsFound);
            }
          }
        }
      }
    } catch (e) {
      // Ignorar silenciosamente se não tiver permissão
    }

    if (errorsFound.length === 0) {
      insights.push({
        type: 'SUCCESS',
        title: 'Nenhum erro crítico detectado nos logs',
        content: 'Todos os logs analisados estão limpos. Nenhuma exceção não tratada ou erro 429/500 detectado recentemente.'
      });
    } else {
      // Deduplicate and take top 5
      const uniqueErrors = Array.from(new Set(errorsFound.map(e => e.message)))
        .map(msg => errorsFound.find(e => e.message === msg))
        .slice(0, 5);

      insights.push({
        type: 'ALERT',
        title: `Detectados ${errorsFound.length} erros nos logs de execução`,
        content: `Os seguintes erros recorrentes foram encontrados:\n\n${uniqueErrors.map(e => `- **[${e.source}]** \`${e.message}\` (em ${path.basename(e.filePath)})`).join('\n')}`
      });
    }

    return insights;
  }

  parseLogFile(filePath, errorsFound) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Detect typical error keywords
        if (line.includes('Error:') || line.includes('Exception') || line.includes('429 Too Many Requests') || line.includes('Rate limit') || line.includes('Failed to') || line.includes('ERRO')) {
          // Ignore warnings or debug messages
          if (line.includes('warning') || line.includes('info') || line.includes('debug')) return;
          
          errorsFound.push({
            filePath,
            line: index + 1,
            message: line.trim().substring(0, 200),
            source: filePath.includes('.system_generated') ? 'System Task' : 'Workspace Log'
          });
        }
      });
    } catch (e) {
      // Ignorar falhas na leitura de arquivos individuais
    }
  }
}

module.exports = LogAnalyzerAgent;
