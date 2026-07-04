const fs = require('fs');
const path = require('path');

class BugHunterAgent {
  constructor() {
    this.name = 'BugHunterAgent';
  }

  async execute() {
    console.log(`[${this.name}] Executando busca por bugs lógicos...`);
    const insights = [];
    const bugsFound = [];

    const srcDir = path.join(__dirname, '../../src');
    this.scanDirectory(srcDir, bugsFound);

    if (bugsFound.length === 0) {
      insights.push({
        type: 'SUCCESS',
        title: 'Nenhum bug estático identificado',
        content: 'A varredura estática não identificou blocos catch vazios, chamadas de banco sem tratamento ou promessas esquecidas.'
      });
    } else {
      insights.push({
        type: 'WARNING',
        title: `Identificados ${bugsFound.length} possíveis problemas lógicos`,
        content: `Os seguintes pontos requerem atenção do desenvolvedor:\n\n${bugsFound.slice(0, 10).map(b => `- **${b.file} (linha ${b.line})**: ${b.desc} (\`${b.snippet}\`)`).join('\n')}`
      });
    }

    return insights;
  }

  scanDirectory(dir, bugsFound) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath, bugsFound);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        this.checkFileForBugs(fullPath, bugsFound);
      }
    }
  }

  checkFileForBugs(filePath, bugsFound) {
    const relativePath = path.relative(path.join(__dirname, '../../'), filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // 1. Catch blocos vazios
      if (line.includes('catch') && line.includes('{') && (line.includes('}') || lines[index + 1]?.trim() === '}')) {
        bugsFound.push({
          file: relativePath,
          line: index + 1,
          desc: 'Tratamento de erro vazio (catch silencioso)',
          snippet: line.trim()
        });
      }

      // 2. Uso de process.env sem fallback ou sem verificação de undefined fora do construtor
      if (line.includes('process.env.') && !line.includes('!') && !line.includes('||') && !line.includes('?') && !filePath.includes('next.config') && !filePath.includes('BlingProvider')) {
        if (line.includes('const ') || line.includes('let ') || line.includes('var ')) {
          bugsFound.push({
            file: relativePath,
            line: index + 1,
            desc: 'Acesso a process.env sem tratamento ou fallback de undefined',
            snippet: line.trim()
          });
        }
      }

      // 3. Promessas do Supabase que podem ser chamadas sem await (erro comum)
      if (line.includes('supabaseAdmin.') || line.includes('supabase.')) {
        if (!line.includes('await ') && !line.includes('return ') && !line.includes('const ') && !line.includes('let ')) {
          bugsFound.push({
            file: relativePath,
            line: index + 1,
            desc: 'Chamada do cliente Supabase potencialmente não aguardada (falta await ou return)',
            snippet: line.trim()
          });
        }
      }
    });
  }
}

module.exports = BugHunterAgent;
