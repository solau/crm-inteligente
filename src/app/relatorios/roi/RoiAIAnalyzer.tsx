'use client';

import { useState } from 'react';
import { BrainCircuit, Loader2, Sparkles } from 'lucide-react';

export default function RoiAIAnalyzer({ stats }: { stats: any }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/roi-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar análise');
      
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={generateAnalysis}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm shadow-md disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
        <span>Analisar com IA</span>
      </button>

      {/* Modal/Dropdown com a Análise */}
      {analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-indigo-600/10 border-b border-indigo-500/20 flex items-center justify-between">
              <h3 className="font-bold text-lg text-indigo-500 flex items-center gap-2">
                <Sparkles size={20} />
                Insights Estratégicos (IA)
              </h3>
              <button 
                onClick={() => setAnalysis(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Fechar
              </button>
            </div>
            <div className="p-6 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {analysis}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 text-rose-500 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
