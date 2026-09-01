'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Clock, 
  Flame, 
  CheckCircle2, 
  BellRing,
  Calendar,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface HourlyGoalMonitorProps {
  initialMsgsToday?: number;
  sellerName?: string;
  className?: string;
  compact?: boolean;
}

// Helper para obter data e hora exatas no fuso horário do Brasil (America/Sao_Paulo - UTC-3)
const getBrasiliaTime = (date: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short'
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  parts.forEach(p => { partMap[p.type] = p.value; });

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  // Determinar o dia da semana em Brasília (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
  const brDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const dayOfWeek = brDate.getUTCDay();

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    isSunday: dayOfWeek === 0,
    formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    currentHourKey: `${year}-${month}-${day}-${hour}` // chave única por hora
  };
};

export default function HourlyGoalMonitor({
  initialMsgsToday,
  sellerName,
  className = '',
  compact = false
}: HourlyGoalMonitorProps) {
  const [msgsToday, setMsgsToday] = useState<number>(initialMsgsToday ?? 0);
  const [mutedHourKey, setMutedHourKey] = useState<string | null>(null);
  const [isPlayingSiren, setIsPlayingSiren] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const sirenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Armazena qual hora já tocou a sirene para não repetir em loop dentro da mesma hora
  const lastTriggeredHourKeyRef = useRef<string | null>(null);

  const DAILY_GOAL = 60;

  // Atualizar hora corrente no cliente a cada 15s
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

  // Recuperar estado de mute da sessão para a hora atual
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('siren_muted_hour');
      if (saved) {
        setMutedHourKey(saved);
      }
    } catch (e) {}
  }, []);

  // Buscar mensagens atualizadas do vendedor a cada 60s
  const fetchTodayMsgs = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await fetch('/api/vendedor/stats-hoje');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.msgsToday === 'number') {
          setMsgsToday(data.msgsToday);
        }
      }
    } catch (e) {
      console.error('Erro ao atualizar stats de hoje:', e);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayMsgs();
    const interval = setInterval(fetchTodayMsgs, 60000);
    return () => clearInterval(interval);
  }, [fetchTodayMsgs]);

  // Cálculo da Meta Horária com Fuso de Brasília
  const calculation = (() => {
    if (!currentTime) {
      return {
        expectedMsgs: 0,
        deficit: 0,
        isBehind: false,
        hoursPassed: 0,
        formattedTime: '--:--',
        isSunday: false,
        scheduleLabel: 'Segunda a Sábado: 09h às 19h (6 msgs/h)',
        ratePerHour: 6,
        progressPercent: 0,
        isShiftEnded: false,
        isShiftNotStarted: false,
        currentHourKey: '',
        nextHourStr: '',
        isCurrentlyMuted: false
      };
    }

    const brTime = getBrasiliaTime(currentTime);
    const { hour, minute, isSunday, formattedTime, currentHourKey } = brTime;

    const startHour = isSunday ? 10 : 9;
    const endHour = isSunday ? 16 : 19;
    const totalShiftHours = endHour - startHour;
    const ratePerHour = Math.round(DAILY_GOAL / totalShiftHours); // 10 msgs/h Dom, 6 msgs/h Seg-Sáb

    const currentDecimalHour = hour + (minute / 60);

    let hoursPassed = 0;
    let isShiftNotStarted = false;
    let isShiftEnded = false;

    if (currentDecimalHour < startHour) {
      hoursPassed = 0;
      isShiftNotStarted = true;
    } else if (currentDecimalHour >= endHour) {
      hoursPassed = totalShiftHours;
      isShiftEnded = true;
    } else {
      hoursPassed = currentDecimalHour - startHour;
    }

    // Meta esperada até o momento atual
    let expectedMsgs = 0;
    if (isShiftNotStarted) {
      expectedMsgs = 0;
    } else if (isShiftEnded) {
      expectedMsgs = DAILY_GOAL;
    } else {
      expectedMsgs = Math.round(hoursPassed * (DAILY_GOAL / totalShiftHours));
    }

    const deficit = expectedMsgs - msgsToday;
    const isBehind = expectedMsgs > 0 && deficit > 0;
    const progressPercent = Math.min(100, Math.round((msgsToday / DAILY_GOAL) * 100));

    const scheduleLabel = isSunday
      ? 'Domingo: 10h às 16h (Ritmo: 10 msgs/hora)'
      : 'Segunda a Sábado: 09h às 19h (Ritmo: 6 msgs/hora)';

    // Próxima hora formatada para o rearme do alarme
    const nextHour = (hour + 1) % 24;
    const nextHourStr = `${String(nextHour).padStart(2, '0')}:00`;

    // O alarme só está mutado se a chave mutada for EXATAMENTE a hora atual
    const isCurrentlyMuted = mutedHourKey === currentHourKey;

    return {
      expectedMsgs,
      deficit,
      isBehind,
      hoursPassed: Math.round(hoursPassed * 10) / 10,
      formattedTime,
      isSunday,
      scheduleLabel,
      ratePerHour,
      progressPercent,
      isShiftEnded,
      isShiftNotStarted,
      currentHourKey,
      nextHourStr,
      isCurrentlyMuted
    };
  })();

  // Função para Tocar Sirene com Web Audio API
  const startSiren = useCallback((durationMs: number = 3500) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtxClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      stopSiren();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, ctx.currentTime);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(2.5, ctx.currentTime);
      lfoGain.gain.setValueAtTime(200, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + (durationMs / 1000) - 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start();
      osc.start();

      oscRef.current = osc;
      gainRef.current = gain;
      lfoRef.current = lfo;
      lfoGainRef.current = lfoGain;
      setIsPlayingSiren(true);

      sirenTimeoutRef.current = setTimeout(() => {
        stopSiren();
      }, durationMs);
    } catch (err) {
      console.warn('Web Audio API não inicializada:', err);
    }
  }, []);

  const stopSiren = useCallback(() => {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
        gainRef.current = null;
      }
      if (sirenTimeoutRef.current) {
        clearTimeout(sirenTimeoutRef.current);
        sirenTimeoutRef.current = null;
      }
    } catch (e) {}
    setIsPlayingSiren(false);
  }, []);

  // REARME AUTOMÁTICO NA PRÓXIMA HORA:
  // Dispara a sirene uma vez por hora cheia caso o usuário continue em déficit
  useEffect(() => {
    if (
      calculation.isBehind && 
      !calculation.isCurrentlyMuted && 
      calculation.currentHourKey && 
      lastTriggeredHourKeyRef.current !== calculation.currentHourKey
    ) {
      lastTriggeredHourKeyRef.current = calculation.currentHourKey;
      startSiren(4000); // toca 4s de sirene
    }
  }, [calculation.isBehind, calculation.isCurrentlyMuted, calculation.currentHourKey, startSiren]);

  // Função para pausar a sirene apenas até a próxima hora cheia
  const handleToggleMute = () => {
    if (calculation.isCurrentlyMuted) {
      // Desmutar imediatamente
      setMutedHourKey(null);
      try { sessionStorage.removeItem('siren_muted_hour'); } catch (e) {}
      startSiren(2500); // feedback sonoro
    } else {
      // Mutar apenas durante a hora atual (expira na próxima hora cheia)
      stopSiren();
      setMutedHourKey(calculation.currentHourKey);
      try { sessionStorage.setItem('siren_muted_hour', calculation.currentHourKey); } catch (e) {}
    }
  };

  return (
    <div className={`w-full transition-all duration-500 ${className}`}>
      {calculation.isBehind ? (
        // 🚨 BANNER DE ALERTA: ABAIXO DA META HORÁRIA
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/95 via-red-900/70 to-zinc-900/95 border-2 border-rose-500/70 p-5 md:p-6 shadow-2xl shadow-rose-950/60">
          
          {/* Luz de Sirene de Fundo */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            
            {/* Lado Esquerdo: Ícone de Sirene + Mensagem Explícita */}
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/25 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/30">
                  <BellRing className={`w-7 h-7 ${isPlayingSiren ? 'animate-spin' : 'animate-pulse'}`} />
                </div>
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] font-black text-white items-center justify-center">!</span>
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-md shadow-rose-500/40">
                    🚨 ALERTA DE RITMO HORÁRIO
                  </span>
                  <span className="text-xs font-semibold text-rose-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {calculation.formattedTime} (Horário de Brasília)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-700">
                    {calculation.scheduleLabel}
                  </span>
                </div>

                <h3 className="text-lg md:text-xl font-black text-white tracking-tight leading-snug">
                  Você está <span className="text-rose-400 underline decoration-rose-500 decoration-2 underline-offset-4 font-black">{calculation.deficit} mensagens abaixo</span> do esperado para este horário!
                </h3>

                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed max-w-3xl">
                  {sellerName ? `${sellerName}, você` : 'Você'} enviou <strong className="text-white font-black">{msgsToday}</strong> mensagens hoje, mas a meta esperada até às {calculation.formattedTime} é de no mínimo <strong className="text-amber-300 font-black">{calculation.expectedMsgs} mensagens</strong> ({calculation.ratePerHour} msgs/hora no turno de {calculation.isSunday ? 'Domingo (10h às 16h)' : 'Segunda a Sábado (09h às 19h)'}).
                </p>

                {calculation.isCurrentlyMuted && (
                  <p className="text-[11px] text-amber-300/90 font-semibold flex items-center gap-1 mt-1">
                    <VolumeX className="w-3.5 h-3.5" /> Alarme pausado temporariamente. A sirene voltará a soar automaticamente às {calculation.nextHourStr} se a meta não for atingida.
                  </p>
                )}
              </div>
            </div>

            {/* Lado Direito: Controles de Áudio da Sirene e Métricas Rápidas */}
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 md:border-l border-rose-500/30 pt-3 md:pt-0 md:pl-6 flex-shrink-0">
              
              <div className="text-left md:text-right">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Ritmo de Hoje</p>
                <div className="flex items-center gap-1 text-base font-black text-white">
                  <span className="text-rose-400 text-xl">{msgsToday}</span>
                  <span className="text-zinc-500 text-xs">/ {DAILY_GOAL} msgs (dia)</span>
                </div>
              </div>

              {/* Botões de Ação do Som */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (isPlayingSiren) {
                      stopSiren();
                    } else {
                      startSiren(4000);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isPlayingSiren
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 border-rose-500/40'
                  }`}
                  title="Testar som da sirene de alerta"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>{isPlayingSiren ? 'Parar Sirene' : 'Testar Sirene'}</span>
                </button>

                <button
                  onClick={handleToggleMute}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    calculation.isCurrentlyMuted
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                      : 'bg-rose-950 text-rose-300 border-rose-600/40 hover:bg-rose-900'
                  }`}
                  title={calculation.isCurrentlyMuted ? 'Reativar alarme de sirene' : `Pausar sirene até às ${calculation.nextHourStr}`}
                >
                  {calculation.isCurrentlyMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pausado até {calculation.nextHourStr}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-rose-300" />
                      <span>Silenciar até {calculation.nextHourStr}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Barra de Progresso Horário */}
          <div className="mt-4 pt-3 border-t border-rose-500/20">
            <div className="flex justify-between items-center text-[11px] font-bold text-zinc-300 mb-1.5">
              <span>Progresso Atual: {msgsToday} de {DAILY_GOAL} msgs no dia</span>
              <span className="text-rose-400 font-extrabold">{calculation.progressPercent}% concluído</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-950/80 rounded-full overflow-hidden border border-rose-500/30">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, calculation.progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        // ✅ BANNER POSITIVO: NO RITMO OU ACIMA DA META HORÁRIA
        <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-white">
                    Ritmo de Disparos em Dia ({calculation.ratePerHour} msgs / hora)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Meta Cumprida
                  </span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800">
                    {calculation.scheduleLabel}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Você enviou <strong className="text-emerald-400 font-bold">{msgsToday}</strong> de <strong className="text-white">60 mensagens</strong> hoje. Meta esperada até às {calculation.formattedTime} (Brasília): <strong className="text-white">{calculation.expectedMsgs} msgs</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-950 px-3.5 py-2 rounded-2xl border border-zinc-800">
              <div className="text-right">
                <p className="text-[10px] text-zinc-400 font-semibold uppercase">Hoje</p>
                <p className="text-base font-black text-emerald-400 leading-none mt-0.5">
                  {msgsToday} <span className="text-xs text-zinc-500 font-normal">/ 60</span>
                </p>
              </div>
              
              <button
                onClick={() => startSiren(2000)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Testar efeito sonoro de sirene"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
