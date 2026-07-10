'use client';
import { Phone, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface KanbanCardProps {
  client: any;
  campaignType: string;
  session?: any;
  onMessageSent?: (clientId: string) => void;
}

export function KanbanCard({ client, campaignType, session, onMessageSent }: KanbanCardProps) {
  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const registerInteraction = async () => {
    // Registra a interação no banco (API)
    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: client.tenant_id,
          client_id: client.id,
          campaign_type: campaignType,
          user_id: session?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.id) ? session.id : null
        })
      });
      // Oculta o card instantaneamente
      if (onMessageSent) {
        onMessageSent(client.id);
      }
    } catch (err) {
      console.error('Erro ao registrar interação', err);
    }
  };

  // Texto padrão do WhatsApp
  let wppText = `Olá ${client.name}, tudo bem?`;
  if (campaignType.includes('CASHBACK')) {
    wppText = `Olá ${client.name}, vi que você tem ${formatMoney(client.cashback_balance)} em cashback que vai expirar logo. Quer aproveitar?`;
  }

  const wppLink = `https://wa.me/55${client.phone}?text=${encodeURIComponent(wppText)}`;

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all mb-3 group relative">
      <div className="flex justify-between items-start mb-2">
        <Link href={`/clientes/${client.id}`} className="font-semibold text-white/90 hover:text-white text-sm truncate pr-2 flex-1 hover:underline">
          {client.name}
        </Link>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
            Score: {client.lead_score}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col gap-1 mb-3">
        {client.cashback_balance > 0 && client.has_active && (
          <div className="text-xs text-white/70 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            Cashback: {formatMoney(client.cashback_balance)}
          </div>
        )}
        {client.total_expired_amount > 0 && (
          <div className="text-xs text-rose-300 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Perdido: {formatMoney(client.total_expired_amount)}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-1">
        <button 
          onClick={registerInteraction}
          className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 hover:text-white/90 bg-white/5 hover:bg-white/15 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Marcar como contatado sem abrir o WhatsApp"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Já Falei
        </button>
        <a 
          href={wppLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => registerInteraction()}
          className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
