import { supabaseAdmin } from '@/lib/supabase';
import { QuizQuestionPublic, QuizSubmissionResult, Coupon } from '@/lib/types/events';
import { CouponRepository } from './CouponRepository';

export interface InternalQuizQuestion {
  id: string;
  order_num: number;
  question_text: string;
  explanation: string;
  options: {
    letter: string;
    option_text: string;
    is_correct: boolean;
  }[];
}

export const OFFICIAL_QUIZ_QUESTIONS: InternalQuizQuestion[] = [
  {
    id: 'q1',
    order_num: 1,
    question_text: 'Qual é a principal característica que define a carne Wagyu e sua alta pontuação de marmoreio (BMS)?',
    explanation: 'O marmoreio do Wagyu é composto por gorduras monoinsaturadas entremeadas que derretem em temperatura corporal, garantindo maciez inigualável.',
    options: [
      { letter: 'A', option_text: 'Coloração avermelhada escura e baixo teor de gordura intramuscular', is_correct: false },
      { letter: 'B', option_text: 'Intenso marmoreio (gordura entremeada) que confere maciez extrema e suculência única', is_correct: true },
      { letter: 'C', option_text: 'Maturação a seco exclusivamente por mais de 90 dias', is_correct: false },
      { letter: 'D', option_text: 'Origem de animais criados apenas com pastagem nativa', is_correct: false }
    ]
  },
  {
    id: 'q2',
    order_num: 2,
    question_text: 'O corte nobre Tomahawk é extraído de qual região anatômica do bovino?',
    explanation: 'O Tomahawk é o corte do ancho (contrafilé dianteiro) mantido com o osso longo da costela limpo.',
    options: [
      { letter: 'A', option_text: 'Do lombo dianteiro (contrafilé/ancho), preservando o osso inteiro da costela', is_correct: true },
      { letter: 'B', option_text: 'Da alcatra superior, logo abaixo da picanha', is_correct: false },
      { letter: 'C', option_text: 'Do peito bovino com corte transversal em fatias', is_correct: false },
      { letter: 'D', option_text: 'Do miolo da paleta bovina', is_correct: false }
    ]
  },
  {
    id: 'q3',
    order_num: 3,
    question_text: 'Para cortes altos nobres, qual é a temperatura interna ideal para o ponto "ao ponto para mal passado"?',
    explanation: 'A faixa entre 54°C e 57°C preserva as fibras tenras e todo o suco natural da carne nobre.',
    options: [
      { letter: 'A', option_text: '45°C a 48°C', is_correct: false },
      { letter: 'B', option_text: '54°C a 57°C', is_correct: true },
      { letter: 'C', option_text: '68°C a 72°C', is_correct: false },
      { letter: 'D', option_text: '80°C a 85°C', is_correct: false }
    ]
  },
  {
    id: 'q4',
    order_num: 4,
    question_text: 'Por que é fundamental deixar a carne descansar por 2 a 3 minutos antes de fatiar?',
    explanation: 'O descanso permite que os sucos e a temperatura se redistribuam por toda a peça, evitando que o líquido escorra na tábua.',
    options: [
      { letter: 'A', option_text: 'Para o sal terminar de penetrar nas fibras mais profundas', is_correct: false },
      { letter: 'B', option_text: 'Para redistribuir os sucos internos e preservar a umidade natural da peça', is_correct: true },
      { letter: 'C', option_text: 'Para resfriar a peça e endurecer a gordura superficial', is_correct: false },
      { letter: 'D', option_text: 'Para fixar a crosta externa', is_correct: false }
    ]
  },
  {
    id: 'q5',
    order_num: 5,
    question_text: 'Qual corte icônico reúne contrafilé e filé mignon separados por um osso em forma de "T"?',
    explanation: 'O T-Bone (e sua versão com maior porção de mignon, o Porterhouse) une contrafilé e filé mignon em uma só experiência.',
    options: [
      { letter: 'A', option_text: 'Prime Rib', is_correct: false },
      { letter: 'B', option_text: 'T-Bone / Porterhouse', is_correct: true },
      { letter: 'C', option_text: 'Short Rib', is_correct: false },
      { letter: 'D', option_text: 'Flat Iron', is_correct: false }
    ]
  }
];

export class QuizRepository {
  private tenantId: string;
  private couponRepo: CouponRepository;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
    this.couponRepo = new CouponRepository(tenantId);
  }

  /**
   * Retorna as perguntas públicas do Quiz SEM as respostas corretas
   */
  getPublicQuizQuestions(): QuizQuestionPublic[] {
    return OFFICIAL_QUIZ_QUESTIONS.map(q => ({
      id: q.id,
      order_num: q.order_num,
      question_text: q.question_text,
      options: q.options.map(o => ({
        letter: o.letter,
        option_text: o.option_text
      }))
    }));
  }

  /**
   * Mapeia número de acertos para desconto conforme regra estrita da campanha:
   * 0 acertos: 0%
   * 1 acerto: 0%
   * 2 acertos: 5%
   * 3 acertos: 8%
   * 4 acertos: 15%
   * 5 acertos: 20%
   */
  calculateDiscount(score: number): number {
    switch (score) {
      case 5: return 20;
      case 4: return 15;
      case 3: return 8;
      case 2: return 5;
      default: return 0;
    }
  }

  /**
   * Submete e corrige as respostas no servidor, emitindo cupom seguro se elegível
   */
  async submitQuiz(data: {
    participant_name: string;
    participant_phone: string;
    participant_email?: string | null;
    company_name?: string | null;
    answers: Record<string, string>; // { q1: 'B', q2: 'A', ... }
    campaign_code?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<QuizSubmissionResult> {
    const rawPhone = data.participant_phone.replace(/\D/g, '');
    const campaignCode = (data.campaign_code || 'BPE26').toUpperCase();

    // 1. Verifica se participante já realizou o quiz e possui cupom emitido para evitar tentativas múltiplas
    const existingCoupon = await this.couponRepo.getActiveCouponByPhone(rawPhone, campaignCode);
    if (existingCoupon) {
      return {
        score: Math.round((existingCoupon.discount_percent / 4)), // Aproximação informativa
        total_questions: OFFICIAL_QUIZ_QUESTIONS.length,
        discount_percent: existingCoupon.discount_percent,
        coupon_code: existingCoupon.code,
        is_new_coupon: false,
        message: 'Você já participou do Quiz! Seu cupom oficial permanece ativo e disponível para uso.'
      };
    }

    // 2. Calcula acertos com segurança total no servidor
    let score = 0;
    for (const q of OFFICIAL_QUIZ_QUESTIONS) {
      const participantAnswer = data.answers[q.id]?.toUpperCase();
      const correctOption = q.options.find(o => o.is_correct);
      if (correctOption && participantAnswer === correctOption.letter) {
        score++;
      }
    }

    const discountPercent = this.calculateDiscount(score);
    let issuedCoupon: Coupon | null = null;

    // 3. Emite cupom se percentual for maior que 0
    if (discountPercent > 0) {
      issuedCoupon = await this.couponRepo.issueCoupon({
        participant_phone: rawPhone,
        participant_name: data.participant_name,
        discount_percent: discountPercent,
        campaign_code: campaignCode
      });
    }

    // 4. Salva a submissão no Supabase (se a tabela existir) com timeout de segurança
    try {
      const insertPromise = supabaseAdmin
        .from('quiz_submissions')
        .insert({
          tenant_id: this.tenantId,
          participant_name: data.participant_name,
          participant_phone: rawPhone,
          participant_email: data.participant_email || null,
          company_name: data.company_name || null,
          answers: data.answers,
          score,
          discount_percent: discountPercent,
          coupon_code: issuedCoupon ? issuedCoupon.code : null,
          ip_address: data.ip_address || null,
          user_agent: data.user_agent || null,
          completed_at: new Date().toISOString()
        });

      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      await Promise.race([insertPromise, timeoutPromise]);
    } catch (e) {
      console.warn('Registro de quiz_submissions no Supabase:', e);
    }

    let message = '';
    if (score === 5) {
      message = 'Sensacional! Você gabaritou o Quiz Alpha Bull e conquistou o desconto máximo de 20% OFF em cortes nobres!';
    } else if (score >= 2) {
      message = `Parabéns! Você acertou ${score} de 5 perguntas e garantiu seu cupom exclusivo de ${discountPercent}% OFF!`;
    } else {
      message = `Você acertou ${score} de 5 perguntas. Continue acompanhando nossos conteúdos para se tornar um mestre churrasqueiro!`;
    }

    return {
      score,
      total_questions: OFFICIAL_QUIZ_QUESTIONS.length,
      discount_percent: discountPercent,
      coupon_code: issuedCoupon ? issuedCoupon.code : undefined,
      is_new_coupon: true,
      message
    };
  }
}
