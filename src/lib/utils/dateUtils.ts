/**
 * dateUtils.ts — Utilitários de data para o CRM
 *
 * REGRA CENTRAL: todos os timestamps são armazenados em UTC no Supabase.
 * Toda exibição para o usuário DEVE usar timeZone: 'America/Sao_Paulo'.
 * Nunca use toLocaleDateString() / toLocaleString() sem o parâmetro timeZone.
 */

const TZ = 'America/Sao_Paulo';
const LOCALE = 'pt-BR';

/**
 * Converte uma string ISO (UTC do Supabase) ou objeto Date em Date JS.
 * Supabase às vezes retorna com espaço ao invés de 'T' — corrigimos aqui.
 */
export function parseUTC(raw: string | Date | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  const normalized = raw.replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata data no padrão brasileiro: "02/09/2026"
 */
export function formatDate(raw: string | Date | null | undefined): string {
  const d = parseUTC(raw);
  if (!d) return '-';
  return d.toLocaleDateString(LOCALE, { timeZone: TZ });
}

/**
 * Formata data e hora: "02/09/2026 às 10:55"
 */
export function formatDateTime(raw: string | Date | null | undefined): string {
  const d = parseUTC(raw);
  if (!d) return '-';
  const date = d.toLocaleDateString(LOCALE, { timeZone: TZ });
  const time = d.toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return `${date} às ${time}`;
}

/**
 * Formata só o horário: "10:55"
 */
export function formatTime(raw: string | Date | null | undefined): string {
  const d = parseUTC(raw);
  if (!d) return '--:--';
  return d.toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/**
 * Formata mês e ano: "setembro de 2026"
 */
export function formatMonthYear(raw: string | Date | null | undefined): string {
  const d = parseUTC(raw);
  if (!d) return '-';
  return d.toLocaleDateString(LOCALE, { timeZone: TZ, month: 'long', year: 'numeric' });
}

/**
 * Retorna quantos dias atrás foi uma data (usando BRT como referência).
 * Exemplo: "3 dias atrás"
 */
export function daysAgo(raw: string | Date | null | undefined): number | null {
  const d = parseUTC(raw);
  if (!d) return null;
  // "hoje" em BRT: pegamos a meia-noite BRT de hoje
  const nowBRT = new Date(new Date().toLocaleString(LOCALE, { timeZone: TZ }));
  const dateBRT = new Date(d.toLocaleString(LOCALE, { timeZone: TZ }));
  const diffMs = nowBRT.getTime() - dateBRT.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retorna a data de hoje em BRT no formato YYYY-MM-DD
 * (útil para comparações com fullOrder.data do Bling)
 */
export function todayBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // 'en-CA' retorna YYYY-MM-DD
}

/**
 * Retorna uma data ISO no fim do dia BRT: "YYYY-MM-DDT23:59:59.000-03:00"
 * Usado ao interpretar datas YYYY-MM-DD vindas do Bling (sem hora).
 */
export function endOfDayBRT(dateStr: string): string {
  return `${dateStr}T23:59:59.000-03:00`;
}

/**
 * Retorna o início do dia atual em BRT como ISO UTC (para queries no Supabase).
 * Exemplo: "2026-09-04T03:00:00.000Z" (00:00 BRT = 03:00 UTC)
 */
export function startOfTodayUTC(): string {
  const todayStr = todayBRT(); // YYYY-MM-DD em BRT
  return new Date(`${todayStr}T00:00:00.000-03:00`).toISOString();
}
