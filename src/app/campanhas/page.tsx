import { CampaignRepository } from '@/lib/infrastructure/repositories/CampaignRepository';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { 
  Sparkles, Megaphone, Calendar, ArrowUpRight, Plus, 
  Target, Users, CheckCircle2, Award 
} from 'lucide-react';

export const revalidate = 0;

export default async function CampanhasPage() {
  const session = await getSession();
  const repo = new CampaignRepository();
  const campaigns = await repo.listCampaigns();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Módulo Reutilizável
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Campanhas Comerciais</h1>
          <p className="text-muted-foreground font-medium text-sm">
            Gerencie campanhas de captação, ações em eventos corporativos, quizzes e benefícios da Alpha Bull.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors text-sm shadow-sm">
          <Plus size={16} />
          <span>Nova Campanha</span>
        </button>
      </div>

      {/* Grid de Campanhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((camp) => (
          <div 
            key={camp.id}
            className="rounded-2xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-xl hover:border-amber-500/40 transition-all flex flex-col overflow-hidden group"
          >
            {/* Top Banner do Card */}
            <div className="p-6 pb-4 border-b border-border/60 bg-muted/20 flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block mb-1">
                  CÓDIGO: {camp.code}
                </span>
                <h3 className="text-lg font-bold text-foreground leading-snug group-hover:text-amber-400 transition-colors">
                  {camp.name}
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                camp.status === 'ativa' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
              }`}>
                {camp.status}
              </span>
            </div>

            {/* Conteúdo do Card */}
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {camp.description || 'Campanha comercial Alpha Bull'}
              </p>

              <div className="space-y-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    Tipo:
                  </span>
                  <span className="text-foreground font-medium">{camp.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    Início:
                  </span>
                  <span className="text-foreground font-medium">
                    {camp.starts_at ? new Date(camp.starts_at).toLocaleDateString('pt-BR') : 'Imediato'}
                  </span>
                </div>
              </div>

              {/* Botão Acessar Resultados */}
              <Link 
                href={`/campanhas/${camp.code.toLowerCase()}`}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-md shadow-amber-500/10"
              >
                <span>Acessar Painel de Resultados</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
