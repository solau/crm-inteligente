'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Flame, 
  Heart, 
  AlertCircle, 
  Search, 
  Filter, 
  DollarSign, 
  TrendingUp, 
  Tag, 
  X, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Bot, 
  RefreshCw,
  Gift,
  Phone
} from 'lucide-react';
import Link from 'next/link';

export interface ClientProfileData {
  id: string;
  name: string;
  phone: string | null;
  last_purchase_date: string | null;
  total_spent: number | null;
  lead_score: number | null;
  cashback_balance: number | null;
  preferences: string | null;
}

interface CustomerProfilesClientProps {
  clients: ClientProfileData[];
}

type ProfileCategory = 'ALL' | 'VIP' | 'FERVENDO' | 'RECORRENTE' | 'AUSENTE' | 'CORRIDA' | 'BPE25';

export default function CustomerProfilesClient({ clients }: CustomerProfilesClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProfileCategory>('ALL');
  const [sortBy, setSortBy] = useState<'LTV' | 'SCORE' | 'RECENCY' | 'NAME'>('LTV');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClientModal, setSelectedClientModal] = useState<ClientProfileData | null>(null);

  const itemsPerPage = 20;
  const now = useMemo(() => new Date(), []);

  const formatMoney = (val: number | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Classificação e clusterização de cada cliente
  const enrichedClients = useMemo(() => {
    return clients.map(c => {
      const ltv = Number(c.total_spent) || 0;
      let recencyDays = 999;
      if (c.last_purchase_date) {
        recencyDays = Math.max(0, Math.floor((now.getTime() - new Date(c.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)));
      }

      const pref = (c.preferences || '').toLowerCase();
      const isCorrida = pref.includes('corrida alphaville');
      const isBpe25 = pref.includes('bpe25') || pref.includes('leads bpe25');

      let category: ProfileCategory = 'RECORRENTE';
      let categoryLabel = 'Recorrente';
      let badgeClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';

      if (isCorrida) {
        category = 'CORRIDA';
        categoryLabel = '🏃 Corrida Alphaville';
        badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      } else if (isBpe25) {
        category = 'BPE25';
        categoryLabel = '🎯 Leads BPE25';
        badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      } else if (ltv >= 800) {
        category = 'VIP';
        categoryLabel = '💎 VIP / High LTV';
        badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      } else if (recencyDays <= 7 && ltv > 0) {
        category = 'FERVENDO';
        categoryLabel = '🔥 Fervendo (<= 7d)';
        badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      } else if (recencyDays > 45 || (ltv === 0 && !isCorrida && !isBpe25)) {
        category = 'AUSENTE';
        categoryLabel = '❄️ Ausente (> 45d)';
        badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      }

      return {
        ...c,
        ltv,
        recencyDays,
        category,
        categoryLabel,
        badgeClass,
        hasCustomPreferences: Boolean(c.preferences && !isCorrida && !isBpe25)
      };
    });
  }, [clients, now]);

  // Contadores dos Clusters
  const clusterCounts = useMemo(() => {
    let vip = 0, fervendo = 0, recorrente = 0, ausente = 0, corrida = 0, bpe25 = 0;
    let totalLtv = 0;

    enrichedClients.forEach(c => {
      totalLtv += c.ltv;
      if (c.category === 'VIP') vip++;
      else if (c.category === 'FERVENDO') fervendo++;
      else if (c.category === 'RECORRENTE') recorrente++;
      else if (c.category === 'AUSENTE') ausente++;
      else if (c.category === 'CORRIDA') corrida++;
      else if (c.category === 'BPE25') bpe25++;
    });

    return {
      vip,
      fervendo,
      recorrente,
      ausente,
      corrida,
      bpe25,
      total: enrichedClients.length,
      totalLtv,
      avgTicket: enrichedClients.length > 0 ? totalLtv / enrichedClients.length : 0
    };
  }, [enrichedClients]);

  // Filtragem e Busca
  const filteredClients = useMemo(() => {
    return enrichedClients.filter(c => {
      // Filtro de Categoria
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
        return false;
      }

      // Filtro de Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = c.name?.toLowerCase().includes(q);
        const phoneMatch = c.phone?.toLowerCase().includes(q);
        const prefMatch = c.preferences?.toLowerCase().includes(q);
        return nameMatch || phoneMatch || prefMatch;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'LTV') return b.ltv - a.ltv;
      if (sortBy === 'SCORE') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'RECENCY') return a.recencyDays - b.recencyDays;
      if (sortBy === 'NAME') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });
  }, [enrichedClients, selectedCategory, searchQuery, sortBy]);

  // Paginação
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  // Gerador de Mensagem de WhatsApp Inteligente
  const generateWhatsAppUrl = (client: ClientProfileData) => {
    const rawPhone = client.phone ? client.phone.replace(/\D/g, '') : '';
    if (!rawPhone) return '#';

    let phone = rawPhone;
    if (!phone.startsWith('55')) phone = '55' + phone;

    const firstName = client.name.split(' ')[0];
    let msg = `Olá, ${firstName}! Tudo bem? Passando para te desejar uma excelente semana!`;

    if (client.preferences && !client.preferences.includes('Origem:')) {
      msg = `Olá, ${firstName}! Tudo bem? A equipe da Alpha Bull preparou uma seleção especial com os cortes premium que você mais aprecia. Posso te enviar os destaques de hoje?`;
    } else if (Number(client.cashback_balance) > 0) {
      msg = `Olá, ${firstName}! Tudo bem? Você possui um saldo de cashback de ${formatMoney(client.cashback_balance)} disponível na Alpha Bull. Gostaria de utilizá-lo no seu próximo pedido?`;
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 text-foreground">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Tático */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-primary/20">
                <Sparkles size={14} className="text-primary" /> Inteligência de Perfis & Hábitos de Consumo
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20">
                Base Total: {clusterCounts.total.toLocaleString('pt-BR')} clientes
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              Inteligência de Perfis dos Clientes
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-1">
              Clusterização preditiva em tempo real com mapeamento de preferências de corte, histórico de LTV e Lead Score RFM.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/agentes"
              className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold px-4 py-2.5 rounded-2xl border border-border transition-all"
            >
              <Bot size={16} className="text-primary" />
              <span>Central de Agentes AI</span>
            </Link>
          </div>
        </div>

        {/* 6 Cards Interativos de Perfis / Clusters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* 1. VIPs */}
          <button
            onClick={() => { setSelectedCategory(selectedCategory === 'VIP' ? 'ALL' : 'VIP'); setCurrentPage(1); }}
            className={`text-left p-5 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md ${
              selectedCategory === 'VIP'
                ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/50'
                : 'bg-card border-border hover:border-amber-500/50 hover:bg-amber-500/5'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck size={18} />
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                LTV &ge; R$ 800
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Clientes VIPs</p>
            <h3 className="text-2xl font-black text-amber-400 mt-0.5">{clusterCounts.vip}</h3>
            <p className="text-[11px] text-muted-foreground mt-2 border-t border-border pt-2">
              Maior rentabilidade
            </p>
          </button>

          {/* 2. Fervendo */}
          <button
            onClick={() => { setSelectedCategory(selectedCategory === 'FERVENDO' ? 'ALL' : 'FERVENDO'); setCurrentPage(1); }}
            className={`text-left p-5 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md ${
              selectedCategory === 'FERVENDO'
                ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/50'
                : 'bg-card border-border hover:border-emerald-500/50 hover:bg-emerald-500/5'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Flame size={18} />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                Compra &le; 7d
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Fervendo</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-0.5">{clusterCounts.fervendo}</h3>
            <p className="text-[11px] text-muted-foreground mt-2 border-t border-border pt-2">
              Pós-venda e retenção
            </p>
          </button>

          {/* 3. Recorrentes */}
          <button
            onClick={() => { setSelectedCategory(selectedCategory === 'RECORRENTE' ? 'ALL' : 'RECORRENTE'); setCurrentPage(1); }}
            className={`text-left p-5 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md ${
              selectedCategory === 'RECORRENTE'
                ? 'bg-sky-500/20 border-sky-500 shadow-lg shadow-sky-500/20 ring-2 ring-sky-500/50'
                : 'bg-card border-border hover:border-sky-500/50 hover:bg-sky-500/5'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                <Heart size={18} />
              </div>
              <span className="text-[10px] font-bold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full border border-sky-400/20">
                8d a 45d
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Recorrentes</p>
            <h3 className="text-2xl font-black text-sky-400 mt-0.5">{clusterCounts.recorrente}</h3>
            <p className="text-[11px] text-muted-foreground mt-2 border-t border-border pt-2">
              Frequência ativa
            </p>
          </button>

          {/* 4. Ausentes */}
          <button
            onClick={() => { setSelectedCategory(selectedCategory === 'AUSENTE' ? 'ALL' : 'AUSENTE'); setCurrentPage(1); }}
            className={`text-left p-5 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md ${
              selectedCategory === 'AUSENTE'
                ? 'bg-rose-500/20 border-rose-500 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/50'
                : 'bg-card border-border hover:border-rose-500/50 hover:bg-rose-500/5'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle size={18} />
              </div>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
                &gt; 45d
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Ausentes (Churn)</p>
            <h3 className="text-2xl font-black text-rose-400 mt-0.5">{clusterCounts.ausente}</h3>
            <p className="text-[11px] text-muted-foreground mt-2 border-t border-border pt-2">
              Ofertas de reativação
            </p>
          </button>

          {/* 5. Corrida Alphaville */}
          <button
            onClick={() => { setSelectedCategory(selectedCategory === 'CORRIDA' ? 'ALL' : 'CORRIDA'); setCurrentPage(1); }}
            className={`text-left p-5 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md ${
              selectedCategory === 'CORRIDA'
                ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/50'
                : 'bg-card border-border hover:border-cyan-500/50 hover:bg-cyan-500/5'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Zap size={18} />
              </div>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                Corrida
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Corrida Alphaville</p>
            <h3 className="text-2xl font-black text-cyan-400 mt-0.5">{clusterCounts.corrida}</h3>
            <p className="text-[11px] text-muted-foreground mt-2 border-t border-border pt-2">
              Leads atletas
            </p>
          </button>

          {/* 6. Leads BPE25 */}
          <button
            onClick={() => { setSelectedCategory(selectedCategory === 'BPE25' ? 'ALL' : 'BPE25'); setCurrentPage(1); }}
            className={`text-left p-5 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md ${
              selectedCategory === 'BPE25'
                ? 'bg-indigo-500/20 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/50'
                : 'bg-card border-border hover:border-indigo-500/50 hover:bg-indigo-500/5'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Tag size={18} />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">
                BPE25
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Leads BPE25</p>
            <h3 className="text-2xl font-black text-indigo-400 mt-0.5">{clusterCounts.bpe25}</h3>
            <p className="text-[11px] text-muted-foreground mt-2 border-t border-border pt-2">
              Prospecção ativa
            </p>
          </button>

        </div>

        {/* Barra de Busca & Filtros Rápidos */}
        <div className="bg-card border border-border p-4 md:p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou corte de carne (ex: Picanha, Wagyu, Prime Steak, BPE25)..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full bg-zinc-900 border border-zinc-700 text-white pl-10 pr-10 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-primary placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-2 rounded-2xl">
                <Filter className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-zinc-400 font-semibold">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-zinc-900 text-white font-bold text-xs focus:outline-none cursor-pointer border-none"
                  style={{ colorScheme: 'dark', backgroundColor: '#18181b', color: '#ffffff' }}
                >
                  <option value="LTV" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>💰 Maior Total Gasto (LTV)</option>
                  <option value="SCORE" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>⭐ Maior Lead Score</option>
                  <option value="RECENCY" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>⏱️ Compra Mais Recente</option>
                  <option value="NAME" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🔤 Nome (A-Z)</option>
                </select>
              </div>

              {selectedCategory !== 'ALL' && (
                <button
                  onClick={() => { setSelectedCategory('ALL'); setSearchQuery(''); }}
                  className="text-xs text-zinc-400 hover:text-white font-medium underline px-2"
                >
                  Limpar Filtros
                </button>
              )}
            </div>

          </div>

          {/* Tag de Resultados */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span>
              Exibindo <strong>{filteredClients.length}</strong> de {clusterCounts.total} clientes encontrados
              {selectedCategory !== 'ALL' && ` na categoria "${selectedCategory}"`}
            </span>
            <span>
              Página {currentPage} de {totalPages}
            </span>
          </div>
        </div>

        {/* Tabela Interativa de Perfis com Dossiê */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6 font-bold">Cliente</th>
                  <th className="py-4 px-4 font-bold">Perfil / Cluster</th>
                  <th className="py-4 px-4 font-bold">Inteligência de Paladar & Preferências</th>
                  <th className="py-4 px-4 text-center font-bold">Última Compra</th>
                  <th className="py-4 px-4 text-right font-bold">Total Gasto (LTV)</th>
                  <th className="py-4 px-4 text-center font-bold">Cashback</th>
                  <th className="py-4 px-4 text-center font-bold">Lead Score</th>
                  <th className="py-4 px-6 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedClients.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      {/* Cliente */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-foreground">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.phone || 'Sem telefone'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Perfil */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${c.badgeClass}`}>
                          {c.categoryLabel}
                        </span>
                      </td>

                      {/* Preferências IA */}
                      <td className="py-4 px-4 max-w-xs">
                        {c.preferences ? (
                          <p className="text-xs text-muted-foreground line-clamp-2" title={c.preferences}>
                            {c.preferences}
                          </p>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">Mapeando histórico...</span>
                        )}
                      </td>

                      {/* Recência */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {c.last_purchase_date ? (
                          <div>
                            <span className="font-semibold text-foreground">
                              {new Date(c.last_purchase_date).toLocaleDateString('pt-BR')}
                            </span>
                            <div className="text-[11px] text-muted-foreground">
                              {c.recencyDays === 0 ? 'Hoje' : `há ${c.recencyDays}d`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* LTV */}
                      <td className="py-4 px-4 text-right font-black whitespace-nowrap text-emerald-400">
                        {formatMoney(c.ltv)}
                      </td>

                      {/* Cashback */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {Number(c.cashback_balance) > 0 ? (
                          <span className="text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                            {formatMoney(c.cashback_balance)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Lead Score */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-xs text-foreground">
                            {c.lead_score || 50} <span className="text-muted-foreground font-normal">/ 100</span>
                          </span>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                            <div 
                              className={`h-full rounded-full ${
                                (c.lead_score || 50) >= 80 ? 'bg-emerald-400' : (c.lead_score || 50) >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${c.lead_score || 50}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {c.phone && (
                            <a
                              href={generateWhatsAppUrl(c)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                              title="Chamar no WhatsApp"
                            >
                              <Phone size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedClientModal(c)}
                            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all"
                          >
                            Dossiê IA &rarr;
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedClients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      Nenhum cliente encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-muted border border-border disabled:opacity-30 hover:bg-muted/80 text-foreground transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-muted border border-border disabled:opacity-30 hover:bg-muted/80 text-foreground transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal de Dossiê IA do Cliente */}
        {selectedClientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative">
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg">
                    {selectedClientModal.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedClientModal.name}</h2>
                    <p className="text-xs text-muted-foreground">{selectedClientModal.phone || 'Sem telefone registrado'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClientModal(null)}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Indicadores Principais */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 border border-border p-3.5 rounded-2xl text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Comprado (LTV)</p>
                  <p className="text-base font-black text-emerald-400 mt-1">{formatMoney(selectedClientModal.total_spent)}</p>
                </div>
                <div className="bg-muted/30 border border-border p-3.5 rounded-2xl text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Lead Score RFM</p>
                  <p className="text-base font-black text-amber-400 mt-1">{selectedClientModal.lead_score || 50} / 100</p>
                </div>
                <div className="bg-muted/30 border border-border p-3.5 rounded-2xl text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Cashback Saldo</p>
                  <p className="text-base font-black text-indigo-400 mt-1">{formatMoney(selectedClientModal.cashback_balance)}</p>
                </div>
              </div>

              {/* Dossiê de Paladar e Hábitos */}
              <div className="space-y-2 bg-muted/20 border border-border p-4 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Sparkles size={16} />
                  <span>Dossiê de Paladar & Hábitos de Consumo</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {selectedClientModal.preferences || 'Cliente em processo de aprendizado contínuo com base nos pedidos.'}
                </p>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-3 pt-2">
                {selectedClientModal.phone && (
                  <a
                    href={generateWhatsAppUrl(selectedClientModal)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Phone size={16} />
                    <span>Iniciar Atendimento no WhatsApp</span>
                  </a>
                )}
                <button
                  onClick={() => setSelectedClientModal(null)}
                  className="px-5 py-3 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-sm transition-colors"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
