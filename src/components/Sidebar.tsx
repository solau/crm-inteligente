import Link from 'next/link';
import { LayoutDashboard, Users, MessageCircle, BarChart3, Settings, LogOut, Target } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-72 h-screen bg-card border-r border-border flex flex-col z-20 flex-shrink-0">
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
        
        <Link href="/clientes" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
          <Users size={20} className="text-muted-foreground" />
          <span>Clientes (Dossiês)</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="p-5 border-t border-border">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium group">
          <LogOut size={20} className="text-muted-foreground group-hover:text-destructive transition-colors" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </aside>
  );
}
