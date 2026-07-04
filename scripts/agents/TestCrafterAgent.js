const fs = require('fs');
const path = require('path');

class TestCrafterAgent {
  constructor() {
    this.name = 'TestCrafterAgent';
  }

  async execute() {
    console.log(`[${this.name}] Procurando arquivos de código órfãos de testes unitários...`);
    const insights = [];
    const missingTests = [];

    const libDir = path.join(__dirname, '../../src/lib');
    this.scanForMissingTests(libDir, missingTests);

    if (missingTests.length === 0) {
      insights.push({
        type: 'SUCCESS',
        title: 'Excelente cobertura de arquivos de teste',
        content: 'Todos os Services e Repositories identificados possuem arquivos de testes correspondentes.'
      });
    } else {
      insights.push({
        type: 'RECOMMENDATION',
        title: `Identificados ${missingTests.length} arquivos sem testes Jest correspondentes`,
        content: `De acordo com as regras de **TDD** em **AGENTS.md**, todo Service e Repositório deve vir acompanhado de testes unitários. Os seguintes arquivos estão órfãos:\n\n${missingTests.map(f => `- \`${f.file}\` (Caminho sugerido: \`${f.suggestedPath}\`)`).join('\n')}`
      });
    }

    return insights;
  }

  scanForMissingTests(dir, missingTests) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (file === '__tests__') continue; // Ignorar o próprio diretório de testes
        this.scanForMissingTests(fullPath, missingTests);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        // Apenas auditar Services e Repositories
        if (file.includes('Service') || file.includes('Repository') || file.includes('UseCase')) {
          const fileNameNoExt = path.basename(file, '.ts');
          
          // Procurar arquivo de teste correspondente no mesmo diretório ou em um subdiretório __tests__
          const testFileInSameDir = path.join(dir, `${fileNameNoExt}.test.ts`);
          const testSpecFileInSameDir = path.join(dir, `${fileNameNoExt}.spec.ts`);
          const testInSubDir = path.join(dir, '__tests__', `${fileNameNoExt}.test.ts`);
          const testSpecInSubDir = path.join(dir, '__tests__', `${fileNameNoExt}.spec.ts`);

          const hasTest = fs.existsSync(testFileInSameDir) || 
                          fs.existsSync(testSpecFileInSameDir) || 
                          fs.existsSync(testInSubDir) || 
                          fs.existsSync(testSpecInSubDir);

          if (!hasTest) {
            const relativeFile = path.relative(path.join(__dirname, '../../'), fullPath);
            const suggestedTestPath = path.relative(
              path.join(__dirname, '../../'),
              path.join(dir, '__tests__', `${fileNameNoExt}.test.ts`)
            );
            missingTests.push({
              file: relativeFile,
              suggestedPath: suggestedTestPath
            });
          }
        }
      }
    }
  }
}

module.exports = TestCrafterAgent;
