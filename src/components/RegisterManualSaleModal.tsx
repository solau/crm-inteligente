'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, X, CheckCircle2, RefreshCw } from 'lucide-react';

interface RegisterManualSaleModalProps {
  clientId: string;
  clientName: string;
}

export default function RegisterManualSaleModal({ clientId, clientName }: RegisterManualSaleModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [totalValue, setTotalValue] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalValue || Number(totalValue) <= 0) {
      setMessage({ text: 'Informe um valor de venda maior que zero.', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const res = await fetch('/api/pedidos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          totalValue: Number(totalValue),
          orderId: orderId.trim() || undefined,
          orderDate: orderDate ? `${orderDate}T12:00:00.000Z` : undefined
        })
      });

      const json = await res.json();

      if (json.success) {
        setMessage({ text: json.message, type: 'success' });
        setTimeout(() => {
          setIsOpen(false);
          router.refresh();
        }, 1500);
      } else {
        setMessage({ text: json.error || 'Falha ao registrar venda.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: 'Erro de conexão ao registrar venda.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-300 active:scale-95"
      >
        <ShoppingBag size={16} />
        <span>Lançar Venda Manual</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Lançar Venda Manual</h3>
                <p className="text-xs text-muted-foreground">Para vendas diretas que não estão no Bling ERP</p>
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground mb-4">
              Cliente: <span className="text-foreground font-semibold">{clientName}</span>
            </p>

            {message && (
              <div className={`p-3 rounded-xl text-xs font-medium mb-4 flex items-center gap-2 ${
                message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
              }`}>
                <CheckCircle2 size={16} />
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Valor Pago da Venda (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 350.00"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Data da Venda
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Número do Pedido (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: MANUAL-1001"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  <span>{loading ? 'Registrando...' : 'Confirmar Venda'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
