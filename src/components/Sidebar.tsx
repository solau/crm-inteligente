import Link from 'next/link';
import { LayoutDashboard, Users, MessageCircle, BarChart3, Settings, LogOut, Target, Bot } from 'lucide-react';
import { getSession } from '@/lib/auth';

export default async function Sidebar() {
  const session = await getSession();

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex w-72 h-screen bg-card border-r border-border flex-col z-20 flex-shrink-0">
        {/* Logo Area */}
        <div className="h-20 flex items-center px-8 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="font-bold text-primary-foreground text-lg">AI</span>
            </div>
            <span className="font-bold text-xl text-foreground tracking-tight">CRM.IA</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-5 space-y-2 overflow-y-auto">
          <div className="mb-4 px-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menu Principal</p>
          </div>
          
          <Link href="/dashboard/agentes" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-primary bg-primary/10 hover:bg-primary/20 transition-colors font-medium border border-primary/20">
            <Bot size={20} className="text-primary" />
            <span>Central de Agentes AI</span>
          </Link>

          <Link href="/clientes" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
            <Users size={20} className="text-muted-foreground" />
            <span>Clientes (Radar)</span>
          </Link>
          <Link href="/vendedor/kanban" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
            <Target size={20} className="text-muted-foreground" />
            <span>Kanban de Vendas</span>
          </Link>
          <Link href="/dashboard/mensagens" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
            <MessageCircle size={20} className="text-muted-foreground" />
            <span>Mensagens Enviadas</span>
          </Link>

          {session?.role === 'ADMIN' && (
            <>
              <Link href="/dashboard/geral" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
                <LayoutDashboard size={20} className="text-muted-foreground" />
                <span>Visão Geral</span>
              </Link>
              <Link href="/dashboard/conversao" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
                <BarChart3 size={20} className="text-muted-foreground" />
                <span>Conversão</span>
              </Link>
              <Link href="/relatorios/roi" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
                <BarChart3 size={20} className="text-muted-foreground" />
                <span>Relatório ROI</span>
              </Link>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-5 border-t border-border">
          <form action="/api/auth/logout" method="POST" className="w-full">
            <button type="submit" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium group">
              <LogOut size={20} className="text-muted-foreground group-hover:text-destructive transition-colors" />
              <span>Sair da Conta</span>
            </button>
          </form>
        </div>
      </aside>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around z-50 px-2 pb-safe">
        <Link href="/clientes" className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
          <Users size={20} />
          <span className="text-[10px] font-medium">Radar</span>
        </Link>
        <Link href="/vendedor/kanban" className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
          <Target size={20} />
          <span className="text-[10px] font-medium">Kanban</span>
        </Link>
        <Link href="/dashboard/mensagens" className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
          <MessageCircle size={20} />
          <span className="text-[10px] font-medium">Msgs</span>
        </Link>
        {session?.role === 'ADMIN' && (
          <>
            <Link href="/dashboard/geral" className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-medium">Geral</span>
            </Link>
            <Link href="/relatorios/roi" className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
              <BarChart3 size={20} />
              <span className="text-[10px] font-medium">ROI</span>
            </Link>
          </>
        )}
        <form action="/api/auth/logout" method="POST" className="flex items-center justify-center">
          <button type="submit" className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-destructive transition-colors p-2">
            <LogOut size={20} />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </form>
      </nav>
    </>
  );
}
