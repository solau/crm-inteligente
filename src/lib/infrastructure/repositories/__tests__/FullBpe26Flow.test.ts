import { 
  generateParticipantToken, 
  verifyParticipantToken, 
  checkRateLimit, 
  isBotSubmission, 
  sanitizeString 
} from '@/lib/utils/security';
import { QuizRepository } from '../QuizRepository';
import { CouponRepository } from '../CouponRepository';
import { calculateLeadPriority } from '@/lib/utils/priorityLogic';
import { getKanbanColumns } from '@/lib/utils/kanbanLogic';

describe('Auditoria & Fluxo Completo BPE26 (Segurança e Integração)', () => {
  const quizRepo = new QuizRepository();
  const couponRepo = new CouponRepository();
  const testPhone = '71999991234';

  describe('1. Segurança Criptográfica & Anti-Abuso', () => {
    test('deve emitir e validar token HMAC de participante com correspondência de telefone', () => {
      const token = generateParticipantToken(testPhone, 'BPE26');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);

      // Validação positiva
      const validCheck = verifyParticipantToken(token, testPhone);
      expect(validCheck.valid).toBe(true);
      expect(validCheck.phone).toBe(testPhone);

      // Validação negativa: tentativa de consultar telefone de terceiro com token diferente
      const thirdPartyPhone = '71988889999';
      const invalidCheck = verifyParticipantToken(token, thirdPartyPhone);
      expect(invalidCheck.valid).toBe(false);
    });

    test('deve rejeitar tokens forjados ou corrompidos', () => {
      const forgedToken = 'eyJuYW1lIjoiYWRtaW4ifQ==';
      const check = verifyParticipantToken(forgedToken, testPhone);
      expect(check.valid).toBe(false);
    });

    test('deve detectar e bloquear preenchimento de honeypot (bots)', () => {
      expect(isBotSubmission({ website_url: 'http://spam-link.com' })).toBe(true);
      expect(isBotSubmission({ _hp_check: 'bot-fill' })).toBe(true);
      expect(isBotSubmission({ company_name: 'Empresa Real', contact_phone: '71999991234' })).toBe(false);
    });

    test('deve aplicar rate limiting após exceder número máximo de requisições', () => {
      const uniqueKey = `test_limit_${Date.now()}`;
      // Limite de 3 requisições
      expect(checkRateLimit(uniqueKey, 3, 5000).allowed).toBe(true);
      expect(checkRateLimit(uniqueKey, 3, 5000).allowed).toBe(true);
      expect(checkRateLimit(uniqueKey, 3, 5000).allowed).toBe(true);
      // 4ª requisição deve ser bloqueada
      const blocked = checkRateLimit(uniqueKey, 3, 5000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetInSec).toBeGreaterThan(0);
    });

    test('deve sanitizar strings contra tags e limitar tamanho máximo', () => {
      const dirty = '<script>alert("xss")</script>Empresa Alpha';
      const clean = sanitizeString(dirty, 50);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Empresa Alpha');
      expect(sanitizeString('Texto muito longo'.repeat(10), 20).length).toBe(20);
    });
  });

  describe('2. Integridade do Quiz e Anti-Duplicação de Cupons', () => {
    test('deve calcular corretamente 5 acertos e emitir cupom de 20% OFF', async () => {
      const result = await quizRepo.submitQuiz({
        participant_name: 'Executivo Teste',
        participant_phone: testPhone,
        answers: {
          q1: 'B',
          q2: 'A',
          q3: 'B',
          q4: 'B',
          q5: 'B'
        }
      });

      expect(result.score).toBe(5);
      expect(result.discount_percent).toBe(20);
      expect(result.coupon_code).toBeDefined();
      expect(result.coupon_code?.startsWith('BPE26-')).toBe(true);
      expect(result.is_new_coupon).toBe(true);
    });

    test('deve impedir emissão de cupom duplicado para o mesmo telefone preservando o anterior', async () => {
      // Segunda tentativa com mesmo telefone
      const secondAttempt = await quizRepo.submitQuiz({
        participant_name: 'Executivo Teste',
        participant_phone: testPhone,
        answers: {
          q1: 'B',
          q2: 'A',
          q3: 'B',
          q4: 'B',
          q5: 'B'
        }
      });

      // Deve informar que já possui cupom ativo
      expect(secondAttempt.is_new_coupon).toBe(false);
      expect(secondAttempt.coupon_code?.startsWith('BPE26-')).toBe(true);
      expect(secondAttempt.message).toContain('Seu cupom oficial permanece ativo');
    });
  });

  describe('3. Priorização Comercial e Alimentação do Kanban', () => {
    const refDate = new Date('2026-10-10');

    test('priorização classifica corretamente os cenários exigidos', () => {
      // 1. Alta: Dentro de 60 dias e >= 26 participantes
      expect(calculateLeadPriority({
        expectedGuests: 50,
        eventDate: '2026-11-20',
        referenceDate: refDate
      })).toBe('ALTA');

      // 2. Média: 15 a 25 convidados
      expect(calculateLeadPriority({
        expectedGuests: 20,
        eventDate: '2026-11-20',
        referenceDate: refDate
      })).toBe('MEDIA');

      // 3. Média: > 60 dias mesmo com grande porte
      expect(calculateLeadPriority({
        expectedGuests: 80,
        eventDate: '2027-04-10',
        referenceDate: refDate
      })).toBe('MEDIA');

      // 4. Em Nutrição: Sem data
      expect(calculateLeadPriority({
        expectedGuests: 40,
        eventDate: null,
        referenceDate: refDate
      })).toBe('EM_NUTRICAO');

      // 5. Outras: Menos de 15 convidados
      expect(calculateLeadPriority({
        expectedGuests: 8,
        eventDate: '2026-11-20',
        referenceDate: refDate
      })).toBe('OUTRAS');
    });

    test('oportunidade de evento deve ser direcionada para colEventos no Kanban', () => {
      const mockClients: any[] = [
        // Lead corporativo BPE26
        {
          id: 'lead-corp-1',
          name: 'Roberto Dantas',
          phone: '71991234567',
          is_event_opportunity: true,
          company_name: 'Dantas Logística',
          expected_guests: 60,
          lead_score: 95,
          next_expire_date: null,
          last_purchase_date: null,
          has_active: false
        },
        // Cliente de cashback normal
        {
          id: 'client-cashback-1',
          name: 'Maria Oliveira',
          phone: '71988881111',
          cashback_balance: 50.00,
          next_expire_date: '2026-10-12',
          last_purchase_date: '2026-09-01',
          has_active: true
        }
      ];

      const columns = getKanbanColumns(mockClients, {}, new Set(), refDate);

      // Lead corporativo deve estar em colEventos
      expect(columns.colEventos.length).toBe(1);
      expect(columns.colEventos[0].id).toBe('lead-corp-1');
      expect(columns.colEventos[0].company_name).toBe('Dantas Logística');

      // Cliente comum de cashback NÃO entra em eventos
      expect(columns.colEventos.find(c => c.id === 'client-cashback-1')).toBeUndefined();
      // Cliente de cashback deve estar na coluna de expiração
      expect(columns.col5d.length + columns.col1d.length).toBeGreaterThan(0);
    });
  });
});
