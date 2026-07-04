'use client';

import React, { useState } from 'react';
import { CheckCircle2, Timer, XCircle, ShoppingBag, AlertCircle } from 'lucide-react';

import { CashbackLedgerEntry } from '@/lib/infrastructure/repositories/CashbackRepository';

interface CashbackLedgerTableProps {
  ledger: CashbackLedgerEntry[];
}

const getStatusIcon = (status: string) => {
  switch(status) {
    case 'ATIVO': return <CheckCircle2 className="text-emerald-400" size={16} />;
    case 'PENDENTE': return <Timer className="text-amber-400" size={16} />;
    case 'EXPIRADO': return <XCircle className="text-rose-400" size={16} />;
    case 'UTILIZADO': return <ShoppingBag className="text-blue-400" size={16} />;
    default: return <AlertCircle size={16} />;
  }
};

const getStatusColor = (status: string) => {
  switch(status) {
    case 'ATIVO': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'PENDENTE': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'EXPIRADO': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    case 'UTILIZADO': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    default: return 'text-muted-foreground bg-muted border-border';
  }
};

export default function CashbackLedgerTable({ ledger }: CashbackLedgerTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(ledger.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = ledger.slice(startIndex, endIndex);

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border bg-muted/20 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Timer className="text-primary" size={18} /> Extrato de Cashback (Ledger)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
            <tr>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Gerado Em</th>
              <th className="px-5 py-3">Válido Até</th>
              <th className="px-5 py-3 text-right">Valor Geração</th>
              <th className="px-5 py-3 text-right">Saldo Atual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  Nenhum tíquete financeiro gerado ainda.
                </td>
              </tr>
            ) : (
              currentItems.map((l, index) => (
                <tr key={l.id || index} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold ${getStatusColor(l.status)}`}>
                      {getStatusIcon(l.status)} {l.status}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(l.created_at || '').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {l.expires_at ? new Date(l.expires_at).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    R$ {Number(l.original_amount).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    R$ {Number(l.remaining_amount).toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ledger.length > itemsPerPage && (
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <span className="text-xs text-muted-foreground">
            Mostrando {startIndex + 1} - {Math.min(endIndex, ledger.length)} de {ledger.length} registros
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
