'use client';

import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

interface BlingOrder {
  id: string;
  numero: string;
  data: string;
  desconto: number;
  total: number;
}

interface OrderHistoryTableProps {
  orders: BlingOrder[];
}

export default function OrderHistoryTable({ orders }: OrderHistoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sort orders descending by date
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = sortedOrders.slice(startIndex, endIndex);

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border bg-muted/20">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="text-muted-foreground" size={18} /> Histórico de Compras (Bling)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
            <tr>
              <th className="px-5 py-3">Pedido</th>
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3 text-right">Desconto Usado</th>
              <th className="px-5 py-3 text-right">Total Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                  Nenhuma compra no ERP.
                </td>
              </tr>
            ) : (
              currentItems.map(compra => (
                <tr key={compra.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium text-foreground">
                    #{compra.numero}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(compra.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-right text-rose-400/80">
                    R$ {Number(compra.desconto).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-emerald-400">
                    R$ {Number(compra.total).toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sortedOrders.length > itemsPerPage && (
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <span className="text-xs text-muted-foreground">
            Mostrando {startIndex + 1} - {Math.min(endIndex, sortedOrders.length)} de {sortedOrders.length} compras
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
