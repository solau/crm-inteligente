import { QuizRepository, OFFICIAL_QUIZ_QUESTIONS } from '../QuizRepository';
import { CouponRepository } from '../CouponRepository';
import { calculateLeadPriority } from '@/lib/utils/priorityLogic';

describe('BPE26 Campaign & Quiz Logic', () => {
  const quizRepo = new QuizRepository();
  const couponRepo = new CouponRepository();

  test('deve calcular corretamente a tabela de descontos do quiz', () => {
    expect(quizRepo.calculateDiscount(0)).toBe(0);
    expect(quizRepo.calculateDiscount(1)).toBe(0);
    expect(quizRepo.calculateDiscount(2)).toBe(5);
    expect(quizRepo.calculateDiscount(3)).toBe(8);
    expect(quizRepo.calculateDiscount(4)).toBe(15);
    expect(quizRepo.calculateDiscount(5)).toBe(20);
  });

  test('as perguntas públicas do quiz NÃO devem conter o campo is_correct', async () => {
    const publicQuestions = await quizRepo.getPublicQuizQuestions();
    expect(publicQuestions.length).toBe(5);
    publicQuestions.forEach((q) => {
      q.options.forEach((opt: any) => {
        expect(opt.is_correct).toBeUndefined();
        expect(opt.letter).toBeDefined();
        expect(opt.option_text).toBeDefined();
      });
    });
  });

  test('as perguntas oficiais devem possuir exatamente uma alternativa correta cada', () => {
    OFFICIAL_QUIZ_QUESTIONS.forEach((q) => {
      const correct = q.options.filter(o => o.is_correct);
      expect(correct.length).toBe(1);
    });
  });

  test('deve emitir cupom com prefixo BPE26 e parâmetros válidos', async () => {
    const coupon = await couponRepo.issueCoupon({
      participant_phone: '71988887777',
      participant_name: 'Teste Empresário',
      discount_percent: 20,
      campaign_code: 'BPE26'
    });

    expect(coupon.code.startsWith('BPE26-')).toBe(true);
    expect(coupon.discount_percent).toBe(20);
    expect(coupon.status).toBe('ATIVO');
  });

  test('regras de priorização comercial devem classificar adequadamente', () => {
    const refDate = new Date('2026-10-10');
    // Evento em 20 dias com 40 convidados -> ALTA
    const alta = calculateLeadPriority({
      expectedGuests: 40,
      eventDate: '2026-10-30',
      referenceDate: refDate
    });
    expect(alta).toBe('ALTA');

    // Evento em 20 dias com 18 convidados -> MEDIA
    const media = calculateLeadPriority({
      expectedGuests: 18,
      eventDate: '2026-10-30',
      referenceDate: refDate
    });
    expect(media).toBe('MEDIA');

    // Menos de 15 convidados -> OUTRAS
    const outras = calculateLeadPriority({
      expectedGuests: 10,
      eventDate: '2026-10-30',
      referenceDate: refDate
    });
    expect(outras).toBe('OUTRAS');

    // Sem data -> EM_NUTRICAO
    const nutricao = calculateLeadPriority({
      expectedGuests: 50,
      eventDate: null,
      referenceDate: refDate
    });
    expect(nutricao).toBe('EM_NUTRICAO');
  });
});
