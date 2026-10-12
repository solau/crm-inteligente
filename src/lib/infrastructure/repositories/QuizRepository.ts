import { supabaseAdmin } from '@/lib/supabase';
import { 
  QuizQuestionPublic, 
  QuizQuestionAdmin, 
  QuizSubmissionResult, 
  QuizSubmissionRecord, 
  QuizMetrics,
  Coupon 
} from '@/lib/types/events';
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
   * Obtém o ID da campanha pelo código
   */
  async getCampaignId(campaignCode: string = 'BPE26'): Promise<string> {
    try {
      const { data } = await supabaseAdmin
        .from('campaigns')
        .select('id')
        .eq('code', campaignCode.toUpperCase())
        .single();
      return data?.id || '48a36f91-8f0e-483c-a0be-fd78eb664d4b';
    } catch {
      return '48a36f91-8f0e-483c-a0be-fd78eb664d4b';
    }
  }

  /**
   * Retorna as 5 perguntas publicadas para a interface pública do tablet SEM gabarito
   */
  async getPublicQuizQuestions(campaignCode: string = 'BPE26'): Promise<QuizQuestionPublic[]> {
    try {
      const campaignId = await this.getCampaignId(campaignCode);
      const { data: questions, error } = await supabaseAdmin
        .from('quiz_questions')
        .select(`
          id,
          order_num,
          question_text,
          quiz_options (
            letter,
            option_text
          )
        `)
        .eq('campaign_id', campaignId)
        .order('order_num', { ascending: true })
        .limit(5);

      if (!error && questions && questions.length === 5) {
        return questions.map((q: any) => ({
          id: q.id,
          order_num: q.order_num,
          question_text: q.question_text,
          options: (q.quiz_options || [])
            .map((o: any) => ({
              letter: o.letter,
              option_text: o.option_text
            }))
            .sort((a: any, b: any) => a.letter.localeCompare(b.letter))
        }));
      }
    } catch (e) {
      console.warn('Fallback para OFFICIAL_QUIZ_QUESTIONS:', e);
    }

    // Fallback gracioso para a lista oficial caso o banco esteja indisponível
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
   * Retorna todo o banco de perguntas com alternativas e gabarito para a administração do CRM
   */
  async getAllBankQuestions(campaignCode: string = 'BPE26'): Promise<QuizQuestionAdmin[]> {
    try {
      const campaignId = await this.getCampaignId(campaignCode);
      const { data: questions, error } = await supabaseAdmin
        .from('quiz_questions')
        .select(`
          id,
          tenant_id,
          campaign_id,
          order_num,
          question_text,
          explanation,
          created_at,
          quiz_options (
            id,
            letter,
            option_text,
            is_correct
          )
        `)
        .eq('campaign_id', campaignId)
        .order('order_num', { ascending: true });

      if (!error && questions && questions.length > 0) {
        return questions.map((q: any) => ({
          id: q.id,
          tenant_id: q.tenant_id,
          campaign_id: q.campaign_id,
          order_num: q.order_num,
          question_text: q.question_text,
          explanation: q.explanation,
          is_active: true,
          is_published: q.order_num <= 5,
          published_order: q.order_num <= 5 ? q.order_num : null,
          category: 'carnes_nobres',
          options: (q.quiz_options || [])
            .map((o: any) => ({
              id: o.id,
              letter: o.letter,
              option_text: o.option_text,
              is_correct: Boolean(o.is_correct)
            }))
            .sort((a: any, b: any) => a.letter.localeCompare(b.letter)),
          created_at: q.created_at
        }));
      }
    } catch (e) {
      console.warn('Erro ao carregar banco de perguntas do Supabase:', e);
    }

    // Fallback estático
    return OFFICIAL_QUIZ_QUESTIONS.map(q => ({
      id: q.id,
      order_num: q.order_num,
      question_text: q.question_text,
      explanation: q.explanation,
      is_active: true,
      is_published: true,
      published_order: q.order_num,
      options: q.options
    }));
  }

  /**
   * Cria ou edita uma pergunta do banco com suas 4 alternativas
   */
  async saveQuestion(data: {
    id?: string;
    question_text: string;
    explanation?: string;
    order_num: number;
    options: {
      letter: string;
      option_text: string;
      is_correct: boolean;
    }[];
    campaign_code?: string;
  }): Promise<{ success: boolean; questionId?: string; error?: string }> {
    try {
      const campaignId = await this.getCampaignId(data.campaign_code || 'BPE26');

      if (!data.options || data.options.length !== 4) {
        return { success: false, error: 'A pergunta deve ter exatamente quatro alternativas (A, B, C, D).' };
      }

      const correctCount = data.options.filter(o => o.is_correct).length;
      if (correctCount !== 1) {
        return { success: false, error: 'A pergunta deve possuir exatamente uma alternativa correta.' };
      }

      let questionId = data.id;

      if (questionId && !questionId.startsWith('q')) {
        // Atualiza pergunta existente
        const { error: updateErr } = await supabaseAdmin
          .from('quiz_questions')
          .update({
            question_text: data.question_text,
            explanation: data.explanation || null,
            order_num: data.order_num
          })
          .eq('id', questionId);

        if (updateErr) throw updateErr;

        // Atualiza ou recria opções
        await supabaseAdmin.from('quiz_options').delete().eq('question_id', questionId);
        for (const opt of data.options) {
          await supabaseAdmin.from('quiz_options').insert({
            question_id: questionId,
            letter: opt.letter.toUpperCase(),
            option_text: opt.option_text,
            is_correct: opt.is_correct
          });
        }
      } else {
        // Cria nova pergunta
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('quiz_questions')
          .insert({
            tenant_id: this.tenantId,
            campaign_id: campaignId,
            order_num: data.order_num,
            question_text: data.question_text,
            explanation: data.explanation || null
          })
          .select('id')
          .single();

        if (insertErr || !inserted) throw insertErr;
        questionId = inserted.id;

        for (const opt of data.options) {
          await supabaseAdmin.from('quiz_options').insert({
            question_id: questionId,
            letter: opt.letter.toUpperCase(),
            option_text: opt.option_text,
            is_correct: opt.is_correct
          });
        }
      }

      return { success: true, questionId };
    } catch (err: any) {
      console.error('Erro ao salvar pergunta do quiz:', err);
      return { success: false, error: err.message || 'Falha ao salvar pergunta.' };
    }
  }

  /**
   * Publica uma nova versão do Quiz contendo exatamente 5 perguntas
   */
  async publishVersion(
    selectedQuestionIds: string[], 
    publishedBy?: string, 
    notes?: string,
    campaignCode: string = 'BPE26'
  ): Promise<{ success: boolean; versionNumber: number; error?: string }> {
    if (selectedQuestionIds.length !== 5) {
      return { success: false, versionNumber: 0, error: 'A versão do quiz deve conter exatamente 5 perguntas selecionadas.' };
    }

    try {
      const campaignId = await this.getCampaignId(campaignCode);

      // 1. Reordena as 5 perguntas selecionadas para order_num 1 a 5
      for (let i = 0; i < selectedQuestionIds.length; i++) {
        const qId = selectedQuestionIds[i];
        if (!qId.startsWith('q')) {
          await supabaseAdmin
            .from('quiz_questions')
            .update({ order_num: i + 1 })
            .eq('id', qId);
        }
      }

      // 2. Tenta registrar na tabela quiz_versions se disponível
      try {
        const { data: lastVer } = await supabaseAdmin
          .from('quiz_versions')
          .select('version_number')
          .eq('campaign_id', campaignId)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVerNum = (lastVer?.[0]?.version_number || 1) + 1;

        // Arquiva anteriores
        await supabaseAdmin
          .from('quiz_versions')
          .update({ status: 'arquivada' })
          .eq('campaign_id', campaignId)
          .eq('status', 'publicada');

        // Cria nova versão publicada
        await supabaseAdmin
          .from('quiz_versions')
          .insert({
            tenant_id: this.tenantId,
            campaign_id: campaignId,
            version_number: nextVerNum,
            title: `Desafio Alpha Bull — Versão ${nextVerNum}`,
            status: 'publicada',
            question_ids: selectedQuestionIds,
            published_at: new Date().toISOString(),
            published_by: publishedBy || null,
            notes: notes || `Versão ${nextVerNum} publicada com 5 perguntas selecionadas.`
          });

        return { success: true, versionNumber: nextVerNum };
      } catch (verErr) {
        // Se a tabela quiz_versions ainda não tiver sido criada em produção, a reordenação em quiz_questions já garante a publicação
        console.warn('Registro em quiz_versions ignorado:', verErr);
        return { success: true, versionNumber: 2 };
      }
    } catch (err: any) {
      console.error('Erro ao publicar versão do quiz:', err);
      return { success: false, versionNumber: 0, error: err.message || 'Falha ao publicar versão do quiz.' };
    }
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
   * Submete e corrige as respostas no backend com segurança absoluta,
   * emite cupom único BPE26-XXXXX e vincula cliente e lead
   */
  async submitQuiz(data: {
    participant_name: string;
    participant_phone: string;
    participant_email?: string | null;
    company_name?: string | null;
    answers: Record<string, string>; // { [question_id]: 'B' }
    campaign_code?: string;
    origin_channel?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<QuizSubmissionResult> {
    const rawPhone = data.participant_phone.replace(/\D/g, '');
    const campaignCode = (data.campaign_code || 'BPE26').toUpperCase();
    const originChannel = data.origin_channel || 'BPE26_QUIZ_STAND';

    // 1. Verifica se participante já realizou o quiz e possui cupom emitido para evitar tentativas múltiplas
    const existingCoupon = await this.couponRepo.getActiveCouponByPhone(rawPhone, campaignCode);
    if (existingCoupon) {
      return {
        score: Math.round((existingCoupon.discount_percent / 4)),
        total_questions: 5,
        discount_percent: existingCoupon.discount_percent,
        coupon_code: existingCoupon.code,
        is_new_coupon: false,
        message: 'Você já participou do Desafio Alpha Bull! Seu cupom oficial permanece ativo e disponível para uso.'
      };
    }

    // 2. Busca as 5 perguntas publicadas com gabarito no banco
    const bankQuestions = await this.getAllBankQuestions(campaignCode);
    const activeQuestions = bankQuestions.slice(0, 5);

    // 3. Corrige com segurança 100% no servidor
    let score = 0;
    for (const q of activeQuestions) {
      const participantAnswer = (data.answers[q.id] || '').toUpperCase().trim();
      const correctOption = q.options.find(o => o.is_correct);
      if (correctOption && participantAnswer === correctOption.letter) {
        score++;
      }
    }

    const discountPercent = this.calculateDiscount(score);
    let issuedCoupon: Coupon | null = null;

    // 4. Emite cupom se percentual for maior que 0 (2 ou mais acertos)
    if (discountPercent > 0) {
      issuedCoupon = await this.couponRepo.issueCoupon({
        participant_phone: rawPhone,
        participant_name: data.participant_name,
        discount_percent: discountPercent,
        campaign_code: campaignCode
      });
    }

    // 5. Vincula ou identifica cliente e oportunidade de evento
    let clientId: string | null = null;
    let opportunityId: string | null = null;
    try {
      // Localiza cliente pelo telefone
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('phone', rawPhone)
        .limit(1)
        .maybeSingle();

      if (client) {
        clientId = client.id;
      }

      // Localiza oportunidade BPE26 existente
      const { data: opp } = await supabaseAdmin
        .from('event_opportunities')
        .select('id, notes')
        .eq('contact_phone', rawPhone)
        .limit(1)
        .maybeSingle();

      if (opp) {
        opportunityId = opp.id;
        // Atualiza notas da oportunidade adicionando o resultado do quiz
        const quizNote = `\n[QUIZ STAND BPE26]: Acertos ${score}/5 | Desconto ${discountPercent}% | Cupom ${issuedCoupon ? issuedCoupon.code : 'Não elegível'}`;
        const updatedNotes = (opp.notes || '') + quizNote;
        await supabaseAdmin
          .from('event_opportunities')
          .update({ 
            notes: updatedNotes,
            origin_channel: originChannel
          })
          .eq('id', opp.id);
      }
    } catch (e) {
      console.warn('Erro ao associar lead existente ao quiz:', e);
    }

    // 6. Registra na tabela quiz_submissions com segurança
    try {
      const campaignId = await this.getCampaignId(campaignCode);
      await supabaseAdmin
        .from('quiz_submissions')
        .insert({
          tenant_id: this.tenantId,
          campaign_id: campaignId,
          client_id: clientId,
          event_opportunity_id: opportunityId,
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
    } catch (e) {
      console.warn('Erro ao inserir quiz_submissions:', e);
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
      total_questions: 5,
      discount_percent: discountPercent,
      coupon_code: issuedCoupon ? issuedCoupon.code : undefined,
      is_new_coupon: true,
      message
    };
  }

  /**
   * Retorna submissões do Quiz para o relatório e modal do CRM
   */
  async getQuizSubmissions(limit: number = 50): Promise<QuizSubmissionRecord[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('quiz_submissions')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data.map((s: any) => ({
          id: s.id,
          tenant_id: s.tenant_id,
          campaign_id: s.campaign_id,
          client_id: s.client_id,
          event_opportunity_id: s.event_opportunity_id,
          participant_name: s.participant_name,
          participant_phone: s.participant_phone,
          participant_email: s.participant_email,
          company_name: s.company_name,
          answers: s.answers || {},
          score: s.score || 0,
          total_questions: 5,
          discount_percent: Number(s.discount_percent) || 0,
          coupon_code: s.coupon_code,
          origin_channel: s.origin_channel || 'BPE26_QUIZ_STAND',
          quiz_version: s.quiz_version || 1,
          completed_at: s.completed_at || s.created_at
        }));
      }
    } catch (e) {
      console.warn('Erro ao buscar quiz_submissions:', e);
    }
    return [];
  }

  /**
   * Calcula indicadores consolidados de participação e desempenho do Quiz
   */
  async getQuizMetrics(campaignCode: string = 'BPE26'): Promise<QuizMetrics> {
    try {
      const submissions = await this.getQuizSubmissions(200);
      const totalParticipants = submissions.length;
      const completed = submissions.filter(s => s.score !== undefined).length;
      const totalScore = submissions.reduce((acc, s) => acc + (s.score || 0), 0);
      const averageScore = completed > 0 ? Number((totalScore / completed).toFixed(1)) : 0;

      const scoreDist = {
        score0: submissions.filter(s => s.score === 0).length,
        score1: submissions.filter(s => s.score === 1).length,
        score2: submissions.filter(s => s.score === 2).length,
        score3: submissions.filter(s => s.score === 3).length,
        score4: submissions.filter(s => s.score === 4).length,
        score5: submissions.filter(s => s.score === 5).length
      };

      const couponsList = await this.couponRepo.listCoupons(campaignCode);
      const couponsIssued = couponsList.length;
      const couponsUsed = couponsList.filter(c => c.status === 'UTILIZADO').length;
      const avgDiscount = couponsIssued > 0
        ? Number((couponsList.reduce((acc, c) => acc + c.discount_percent, 0) / couponsIssued).toFixed(1))
        : 0;

      return {
        totalParticipantsTablet: totalParticipants,
        quizzesStarted: totalParticipants,
        quizzesCompleted: completed,
        quizzesAbandoned: 0,
        completionRate: totalParticipants > 0 ? Number(((completed / totalParticipants) * 100).toFixed(1)) : 100,
        averageScore,
        scoreDistribution: scoreDist,
        couponsIssued,
        couponsUsed,
        averageDiscount: avgDiscount,
        leadsKit: 0,
        leadsEvento: 0
      };
    } catch (e) {
      console.warn('Erro ao calcular quiz metrics:', e);
      return {
        totalParticipantsTablet: 0,
        quizzesStarted: 0,
        quizzesCompleted: 0,
        quizzesAbandoned: 0,
        completionRate: 100,
        averageScore: 0,
        scoreDistribution: { score0: 0, score1: 0, score2: 0, score3: 0, score4: 0, score5: 0 },
        couponsIssued: 0,
        couponsUsed: 0,
        averageDiscount: 0,
        leadsKit: 0,
        leadsEvento: 0
      };
    }
  }
}
