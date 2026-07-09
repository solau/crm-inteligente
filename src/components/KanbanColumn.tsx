'use client';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  title: string;
  clients: any[];
  campaignType: string;
  color?: string; // ex: 'border-emerald-500'
  session?: any;
  onMessageSent?: (clientId: string) => void;
}

export function KanbanColumn({ title, clients, campaignType, color = 'border-white/20', session, onMessageSent }: KanbanColumnProps) {
  return (
    <div className={`flex flex-col w-[85vw] max-w-[300px] md:w-72 flex-shrink-0 bg-black/20 backdrop-blur-xl rounded-2xl border-t-4 ${color} border-x border-b border-white/10 overflow-hidden h-[calc(100vh-140px)] snap-center`}>
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h3 className="font-semibold text-white/90 text-sm">{title}</h3>
        <span className="text-xs font-medium bg-white/10 text-white/70 px-2 py-1 rounded-full">
          {clients.length}
        </span>
      </div>
      <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
        {clients.length === 0 ? (
          <div className="text-center text-white/40 text-xs py-8">Nenhum cliente</div>
        ) : (
          clients.map(client => (
            <KanbanCard key={client.id} client={client} campaignType={campaignType} session={session} onMessageSent={onMessageSent} />
          ))
        )}
      </div>
    </div>
  );
}
