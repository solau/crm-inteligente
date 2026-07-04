const { execSync } = require('child_process');
const path = require('path');

class FeatureSanityAgent {
  constructor() {
    this.name = 'FeatureSanityAgent';
  }

  async execute() {
    console.log(`[${this.name}] Executando testes de sanidade (Typecheck e Jest)...`);
    const insights = [];
    const rootDir = path.join(__dirname, '../../');

    // 1. Run npx tsc --noEmit
    let typecheckPassed = true;
    let typecheckOutput = '';
    try {
      typecheckOutput = execSync('npx tsc --noEmit', { cwd: rootDir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      typecheckPassed = false;
      typecheckOutput = e.stdout || e.message;
    }

    // 2. Run npx jest (since jest command is not in package.json, we run npx jest directly)
    let testsPassed = true;
    let jestOutput = '';
    try {
      jestOutput = execSync('npx jest --passWithNoTests', { cwd: rootDir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      testsPassed = false;
      jestOutput = e.stderr || e.stdout || e.message;
    }

    // Build insights
    if (typecheckPassed) {
      insights.push({
        type: 'SUCCESS',
        title: 'Verificação de Tipos (Typecheck): OK',
        content: 'O compilador TypeScript (`tsc --noEmit`) compilou a aplicação com sucesso, sem nenhum erro de tipo identificado.'
      });
    } else {
      // Parse compile errors
      const errorCount = (typecheckOutput.match(/error TS/g) || []).length;
      insights.push({
        type: 'ERROR',
        title: `Typecheck: FALHA (${errorCount} erros de tipagem encontrados)`,
        content: `O compilador encontrou erros de tipo. Veja alguns detalhes:\n\`\`\`\n${typecheckOutput.split('\n').slice(0, 8).join('\n')}\n\`\`\``
      });
    }

    if (testsPassed) {
      insights.push({
        type: 'SUCCESS',
        title: 'Testes Unitários (Jest): PASSOU',
        content: 'Todos os testes unitários configurados no repositório foram executados e passaram com sucesso.'
      });
    } else {
      insights.push({
        type: 'ERROR',
        title: 'Testes Unitários (Jest): FALHA',
        content: `Algum teste unitário quebrou durante a execução. Veja a saída do Jest:\n\`\`\`\n${jestOutput.split('\n').slice(0, 10).join('\n')}\n\`\`\``
      });
    }

    return insights;
  }
}

module.exports = FeatureSanityAgent;
