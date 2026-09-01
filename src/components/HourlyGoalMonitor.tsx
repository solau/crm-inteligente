'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Clock, 
  Flame, 
  CheckCircle2, 
  Play, 
  Pause,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  BellRing
} from 'lucide-react';

interface HourlyGoalMonitorProps {
  initialMsgsToday?: number;
  sellerName?: string;
  className?: string;
  compact?: boolean;
}

export default function HourlyGoalMonitor({
  initialMsgsToday,
  sellerName,
  className = '',
  compact = false
}: HourlyGoalMonitorProps) {
  const [msgsToday, setMsgsToday] = useState<number>(initialMsgsToday ?? 0);
  const [isMuted, setIsMuted] = useState(false);
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

  // Parâmetros de Jornada e Meta Horária
  // Meta: 60 mensagens / dia em um expediente de 10h (08:00 às 18:00) -> 6 mensagens por hora
  const WORK_START_HOUR = 8;
  const WORK_END_HOUR = 18;
  const TOTAL_HOURS = WORK_END_HOUR - WORK_START_HOUR; // 10 horas
  const MSGS_PER_HOUR = 6; // 60 msgs / 10h
  const DAILY_GOAL = 60;

  // Atualizar hora corrente no cliente
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 30000); // a cada 30s
    return () => clearInterval(interval);
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
    const interval = setInterval(fetchTodayMsgs, 60000); // 1 minuto
    return () => clearInterval(interval);
  }, [fetchTodayMsgs]);

  // Cálculo da Meta Horária até o momento atual
  const calculation = (() => {
    if (!currentTime) {
      return {
        expectedMsgs: 0,
        deficit: 0,
        isBehind: false,
        hoursPassed: 0,
        formattedTime: '--:--',
        ratePerHour: MSGS_PER_HOUR,
        progressPercent: 0
      };
    }

    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    let hoursPassed = 0;
    if (hour < WORK_START_HOUR) {
      hoursPassed = 0;
    } else if (hour >= WORK_END_HOUR) {
      hoursPassed = TOTAL_HOURS;
    } else {
      hoursPassed = (hour - WORK_START_HOUR) + (minute / 60);
    }

    // Meta esperada até o momento
    let expectedMsgs = 0;
    if (hour < WORK_START_HOUR) {
      expectedMsgs = 0;
    } else if (hour >= WORK_END_HOUR) {
      expectedMsgs = DAILY_GOAL;
    } else {
      expectedMsgs = Math.round(hoursPassed * MSGS_PER_HOUR);
    }

    const deficit = expectedMsgs - msgsToday;
    const isBehind = expectedMsgs > 0 && deficit > 0;
    const progressPercent = Math.min(100, Math.round((msgsToday / DAILY_GOAL) * 100));

    return {
      expectedMsgs,
      deficit,
      isBehind,
      hoursPassed: Math.round(hoursPassed * 10) / 10,
      formattedTime,
      ratePerHour: MSGS_PER_HOUR,
      progressPercent
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

      // Parar qualquer oscilador anterior
      stopSiren();

      // Oscilador principal de sirene (onda dente de serra / triangular)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // LFO para modular a frequência (efeito sweep de sirene de emergência: 600Hz a 950Hz)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, ctx.currentTime);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(2.5, ctx.currentTime); // 2.5 ciclos de subida/descida por segundo
      lfoGain.gain.setValueAtTime(200, ctx.currentTime); // amplitude de variação +/- 200Hz

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // Volume suave
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
      console.warn('Web Audio API não inicializada ou bloqueada pelo navegador:', err);
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

  // Tocar sirene uma vez quando o usuário entrar ou quando detectar atraso
  const hasTriggeredSirenRef = useRef(false);
  useEffect(() => {
    if (calculation.isBehind && !isMuted && !hasTriggeredSirenRef.current && currentTime) {
      hasTriggeredSirenRef.current = true;
      startSiren(4000); // Toca 4s de sirene
    }
  }, [calculation.isBehind, isMuted, currentTime, startSiren]);

  return (
    <div className={`w-full transition-all duration-500 ${className}`}>
      {calculation.isBehind ? (
        // 🚨 BANNER DE ALERTA: ABAIXO DA META HORÁRIA
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/90 via-red-900/60 to-zinc-900/90 border-2 border-rose-500/60 p-5 md:p-6 shadow-2xl shadow-rose-950/50 animate-pulse-subtle">
          
          {/* Luz de Sirene de Fundo */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            
            {/* Lado Esquerdo: Ícone de Sirene + Mensagem Explícita */}
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20 animate-bounce-short">
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
                    <Clock className="w-3.5 h-3.5" /> Agora: {calculation.formattedTime}
                  </span>
                </div>

                <h3 className="text-lg md:text-xl font-black text-white tracking-tight leading-snug">
                  Você está <span className="text-rose-400 underline decoration-rose-500 decoration-2 underline-offset-4 font-black">{calculation.deficit} mensagens abaixo</span> do esperado para este horário!
                </h3>

                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed max-w-3xl">
                  {sellerName ? `${sellerName}, você` : 'Você'} enviou <strong className="text-white font-black">{msgsToday}</strong> mensagens hoje, mas a meta acumulada até às {calculation.formattedTime} é de no mínimo <strong className="text-amber-300 font-black">{calculation.expectedMsgs} mensagens</strong> (ritmo obrigatório de <strong className="text-white">6 mensagens/hora</strong>, jornada das 08h às 18h).
                </p>
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
                  onClick={() => {
                    if (!isMuted) stopSiren();
                    setIsMuted(!isMuted);
                  }}
                  className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                    isMuted
                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      : 'bg-rose-950 text-rose-300 border-rose-600/40 hover:bg-rose-900'
                  }`}
                  title={isMuted ? 'Desmutar sirene' : 'Silenciar sirene'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Ritmo de Disparos em Dia (6 msgs / hora)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Meta Cumprida
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Você enviou <strong className="text-emerald-400 font-bold">{msgsToday}</strong> de <strong className="text-white">60 mensagens</strong> hoje. Meta esperada até às {calculation.formattedTime}: <strong className="text-white">{calculation.expectedMsgs} msgs</strong>.
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
