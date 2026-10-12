-- 08_quiz_management.sql
-- Módulo de Gerenciamento do Quiz Presencial BPE26 (Desafio Alpha Bull)
-- IDEMPOTENTE E 100% SEGURO PARA EXECUÇÃO NO SUPABASE SQL EDITOR

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Versões do Quiz
CREATE TABLE IF NOT EXISTS quiz_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Desafio Alpha Bull — BPE26',
    status VARCHAR(50) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada', 'arquivada')),
    question_ids JSONB DEFAULT '[]'::jsonb, -- Array com os 5 IDs de perguntas selecionadas
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_quiz_versions_campaign_num UNIQUE (campaign_id, version_number)
);

ALTER TABLE quiz_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access quiz versions of their tenant" ON quiz_versions;
CREATE POLICY "Users can access quiz versions of their tenant" ON quiz_versions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quiz_versions_campaign ON quiz_versions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_quiz_versions_status ON quiz_versions(status);

-- 2. Colunas Adicionais em quiz_questions (se não existirem)
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS published_order INTEGER;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'carnes_nobres';

-- 3. Colunas Adicionais em quiz_submissions (se não existirem)
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES quiz_versions(id) ON DELETE SET NULL;
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS quiz_version INTEGER DEFAULT 1;
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS origin_channel VARCHAR(100) DEFAULT 'BPE26_QUIZ_STAND';
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'concluido' CHECK (status IN ('iniciado', 'concluido', 'abandonado'));

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_origin ON quiz_submissions(origin_channel);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_status ON quiz_submissions(status);

-- 4. Seed Inicial da Versão 1 Publicada e do Banco de Perguntas
DO $$
DECLARE
    v_tenant_id UUID;
    v_campaign_id UUID;
    v_version_id UUID;
    v_q1 UUID; v_q2 UUID; v_q3 UUID; v_q4 UUID; v_q5 UUID;
    v_q6 UUID; v_q7 UUID; v_q8 UUID; v_q9 UUID; v_q10 UUID;
BEGIN
    SELECT id, tenant_id INTO v_campaign_id, v_tenant_id 
    FROM campaigns 
    WHERE code = 'BPE26' 
    LIMIT 1;

    IF v_campaign_id IS NOT NULL THEN
        -- Cria ou recupera Versão 1 Publicada
        INSERT INTO quiz_versions (tenant_id, campaign_id, version_number, title, status, published_at, notes)
        VALUES (v_tenant_id, v_campaign_id, 1, 'Desafio Alpha Bull — BPE26 (Versão Oficial do Estande)', 'publicada', NOW(), 'Versão inicial com 5 perguntas para o tablet do estande.')
        ON CONFLICT (campaign_id, version_number) DO UPDATE 
        SET status = 'publicada', published_at = COALESCE(quiz_versions.published_at, NOW())
        RETURNING id INTO v_version_id;

        -- Pergunta 1 (Oficial 1)
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 1, 
            'Qual é a principal característica que define a carne Wagyu e sua alta pontuação de marmoreio (BMS)?',
            'O marmoreio do Wagyu é composto por gorduras monoinsaturadas entremeadas que derretem em temperatura corporal, garantindo maciez inigualável.',
            true, true, 1)
        RETURNING id INTO v_q1;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q1, 'A', 'Coloração avermelhada escura e baixo teor de gordura intramuscular', false),
            (v_q1, 'B', 'Intenso marmoreio (gordura entremeada) que confere maciez extrema e suculência única', true),
            (v_q1, 'C', 'Maturação a seco exclusivamente por mais de 90 dias', false),
            (v_q1, 'D', 'Origem de animais criados apenas com pastagem nativa', false);

        -- Pergunta 2 (Oficial 2)
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 2, 
            'O corte nobre Tomahawk é extraído de qual região anatômica do bovino?',
            'O Tomahawk é o corte do ancho (contrafilé dianteiro) mantido com o osso longo da costela limpo.',
            true, true, 2)
        RETURNING id INTO v_q2;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q2, 'A', 'Do lombo dianteiro (contrafilé/ancho), preservando o osso inteiro da costela', true),
            (v_q2, 'B', 'Da alcatra superior, logo abaixo da picanha', false),
            (v_q2, 'C', 'Do peito bovino com corte transversal em fatias', false),
            (v_q2, 'D', 'Do miolo da paleta bovina', false);

        -- Pergunta 3 (Oficial 3)
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 3, 
            'Para cortes altos nobres, qual é a temperatura interna ideal para o ponto "ao ponto para mal passado"?',
            'A faixa entre 54°C e 57°C preserva as fibras tenras e todo o suco natural da carne nobre.',
            true, true, 3)
        RETURNING id INTO v_q3;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q3, 'A', '45°C a 48°C', false),
            (v_q3, 'B', '54°C a 57°C', true),
            (v_q3, 'C', '68°C a 72°C', false),
            (v_q3, 'D', '80°C a 85°C', false);

        -- Pergunta 4 (Oficial 4)
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 4, 
            'Por que é fundamental deixar a carne descansar por 2 a 3 minutos antes de fatiar?',
            'O descanso permite que os sucos e a temperatura se redistribuam por toda a peça, evitando que o líquido escorra na tábua.',
            true, true, 4)
        RETURNING id INTO v_q4;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q4, 'A', 'Para o sal terminar de penetrar nas fibras mais profundas', false),
            (v_q4, 'B', 'Para redistribuir os sucos internos e preservar a umidade natural da peça', true),
            (v_q4, 'C', 'Para resfriar a peça e endurecer a gordura superficial', false),
            (v_q4, 'D', 'Para fixar a crosta externa', false);

        -- Pergunta 5 (Oficial 5)
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 5, 
            'Qual corte icônico reúne contrafilé e filé mignon separados por um osso em forma de "T"?',
            'O T-Bone (e sua versão com maior porção de mignon, o Porterhouse) une contrafilé e filé mignon em uma só experiência.',
            true, true, 5)
        RETURNING id INTO v_q5;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q5, 'A', 'Prime Rib', false),
            (v_q5, 'B', 'T-Bone / Porterhouse', true),
            (v_q5, 'C', 'Short Rib', false),
            (v_q5, 'D', 'Flat Iron', false);

        -- Atualiza question_ids da Versão 1 com os 5 IDs publicados
        UPDATE quiz_versions 
        SET question_ids = json_build_array(v_q1, v_q2, v_q3, v_q4, v_q5)
        WHERE id = v_version_id;

        -- Perguntas Adicionais para o Banco de Perguntas (Banco Expandido: Perguntas 6 a 10)
        -- Pergunta 6
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 6, 
            'Qual é a diferença entre Dry Aged (maturação a seco) e Wet Aged (maturação úmida)?',
            'O Dry Aged matura a carne sem embalagem em temperatura e umidade controladas concentrando o sabor por desidratação, enquanto o Wet Aged ocorre em saco a vácuo.',
            true, false, null)
        RETURNING id INTO v_q6;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q6, 'A', 'Dry Aged usa marinada ácida e Wet Aged usa apenas sal grosso', false),
            (v_q6, 'B', 'Dry Aged matura a seco em câmara fria concentrando sabores, e Wet Aged matura a vácuo retendo umidade', true),
            (v_q6, 'C', 'Dry Aged é exclusivo de carnes suínas', false),
            (v_q6, 'D', 'Não há diferença sensorial ou microbiológica entre os dois processos', false);

        -- Pergunta 7
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 7, 
            'Qual é o corte bovino conhecido como o "coração da paleta", que ganhou destaque gourmet por sua maciez comparável ao filé mignon?',
            'O Flat Iron (miolo da paleta cortado longitudinalmente sem a membrana central) é o segundo corte mais macio do boi.',
            true, false, null)
        RETURNING id INTO v_q7;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q7, 'A', 'Brisket', false),
            (v_q7, 'B', 'Maminha', false),
            (v_q7, 'C', 'Flat Iron', true),
            (v_q7, 'D', 'Acém com osso', false);

        -- Pergunta 8
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 8, 
            'O que caracteriza o processo de Reação de Maillard no preparo de carnes nobres na grelha?',
            'A Reação de Maillard ocorre acima de 140°C entre aminoácidos e açúcares, formando a famosa crosta dourada e aromática.',
            true, false, null)
        RETURNING id INTO v_q8;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q8, 'A', 'A evaporação total da água interna da carne', false),
            (v_q8, 'B', 'A caramelização e ligação entre aminoácidos e açúcares que cria a crosta dourada e aromática', true),
            (v_q8, 'C', 'O cozimento lento em banho-maria', false),
            (v_q8, 'D', 'O amaciamento químico por enzimas do abacaxi', false);

        -- Pergunta 9
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 9, 
            'Qual é a espessura recomendada para bifes de Ancho ou Chorizo para garantir uma crosta perfeita sem ressecar o centro?',
            'Cortes com pelo menos 2 a 3 dedos (cerca de 3 a 4 cm) permitem selar com calor intenso mantendo o interior suculento.',
            true, false, null)
        RETURNING id INTO v_q9;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q9, 'A', 'Fatias finas de no máximo 0,5 cm', false),
            (v_q9, 'B', 'Aproximadamente 1 cm', false),
            (v_q9, 'C', 'De 2 a 3 dedos de espessura (cerca de 3 a 4 cm)', true),
            (v_q9, 'D', 'Mais de 10 cm invariavelmente', false);

        -- Pergunta 10
        INSERT INTO quiz_questions (tenant_id, campaign_id, order_num, question_text, explanation, is_active, is_published, published_order)
        VALUES (v_tenant_id, v_campaign_id, 10, 
            'Na boutique Alpha Bull, qual corte nobre com osso é famoso por unir elegância visual e suculência máxima para eventos executivos?',
            'O Prime Rib é a costela com ancho nobre, proporcionando uma apresentação imponente e maciez excepcional.',
            true, false, null)
        RETURNING id INTO v_q10;

        INSERT INTO quiz_options (question_id, letter, option_text, is_correct) VALUES
            (v_q10, 'A', 'Prime Rib', true),
            (v_q10, 'B', 'Lagarto redondo', false),
            (v_q10, 'C', 'Patinho moído', false),
            (v_q10, 'D', 'Músculo dianteiro', false);

    END IF;
END $$;
