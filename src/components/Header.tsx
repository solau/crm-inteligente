import { Bell, Search, UserCircle } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border flex items-center justify-between px-10 sticky top-0 z-10">
      
      {/* Barra de Pesquisa */}
      <div className="flex-1 max-w-2xl">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar clientes, leads ou mensagens..." 
            className="flex h-10 w-full rounded-md border border-input bg-background px-11 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          />
        </div>
      </div>

      {/* Ações e Perfil */}
      <div className="flex items-center gap-6 ml-8">
        
        {/* Notificações */}
        <button className="relative p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-all">
          <Bell size={20} />
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-destructive rounded-full"></span>
        </button>

        <div className="h-6 w-px bg-border"></div>
        
        {/* Perfil */}
        <button className="flex items-center gap-3 hover:bg-accent p-2 rounded-xl transition-colors text-left group">
          <div className="flex flex-col hidden md:block">
            <span className="text-sm font-semibold text-foreground">Jorge Equipe</span>
            <span className="text-xs font-medium text-muted-foreground">Administrador</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <UserCircle size={22} className="text-primary-foreground" />
          </div>
        </button>
      </div>
    </header>
  );
}
