# Documentação Oficial das APIs de Integração — Alpha Bull BPE26

Este documento define os contratos oficiais, especificações de segurança e endpoints da API do **CRM Alpha Bull** para a campanha **BPE26 (Bahia Potência Empresarial 2026)**, projetados para consumo pela landing page no site [https://churrascosalvador.com/bpe26](https://churrascosalvador.com/bpe26).

---

## 1. Diretrizes de Segurança & Arquitetura

1. **Protocolo:** HTTPS obrigatório em produção.
2. **CORS:** Habilitado para as origens:
   - `https://churrascosalvador.com`
   - `https://www.churrascosalvador.com`
   - `http://localhost:3000` (desenvolvimento)
   - `http://localhost:5173` (Vite)
3. **Credenciais do Banco:** O navegador do visitante **NÃO possui acesso direto ao Supabase**. Toda a persistência é intermediada pelas rotas da API no servidor Next.js.
4. **Proteção Anti-Abuso (Rate Limiting Adaptado ao Tablet Compartilhado):**
   - Inscrição de participantes e Quiz: máx. **60 requisições/minuto** por IP (permitindo que dezenas de visitantes utilizem o mesmo tablet/WiFi do estande sem bloqueio indevido).
   - Rate limit por participante: máx. **5 requisições/minuto** por número de telefone (evita flooding ou fraudes individuais).
   - Consulta de cupons: máx. **60 requisições/minuto** por IP.
   - *HTTP 429 Too Many Requests* retornado em caso de excesso.
5. **Proteção Anti-Bot (Honeypot):**
   - Os endpoints `POST` verificam os campos armadilha `_hp_check` e `website_url`. Devem permanecer vazios em requisições legítimas.
6. **Autenticação de Participante (HMAC-SHA256):**
   - Para evitar que terceiros descubram cupons apenas chutando números de WhatsApp, a consulta de cupom por telefone exige o `participant_token` gerado na conclusão do cadastro ou do quiz.
7. **Isolamento Administrativo:**
   - As rotas `/api/eventos` e `/api/eventos/[id]` são **estritamente administrativas** e exigem autenticação de sessão do CRM Alpha Bull. O site ChurrascoSalvador.com deve consumir apenas os endpoints públicos `/api/bpe26/*`.

---

## 2. Variáveis de Ambiente Necessárias no CRM

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL da instância do Supabase | `https://wxcwevfeybymyrurlzsx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço do Supabase (segredo do servidor) | `sb_secret_...` |
| `TZ` | Fuso horário operacional | `America/Sao_Paulo` |

---

## 3. Endpoints Públicos para o ChurrascoSalvador.com

### 3.1. `GET /api/bpe26/config`
Retorna as diretrizes comerciais públicas da campanha, tabela de descontos e regras vigentes.

- **Autenticação:** Nenhuma (Público)
- **Resposta (200 OK):**
```json
{
  "success": true,
  "data": {
    "campaign_code": "BPE26",
    "campaign_name": "Desafio Alpha Bull — BPE26",
    "description": "Captação de confraternizações empresariais BPE 2026",
    "discount_rules": {
      "0_acertos": "0% OFF",
      "1_acerto": "0% OFF",
      "2_acertos": "5% OFF",
      "3_acertos": "8% OFF",
      "4_acertos": "15% OFF",
      "5_acertos": "20% OFF"
    },
    "product_eligibility": "Válido exclusivamente para compras de produtos elegíveis (cortes nobres) da Alpha Bull. Não aplicável a serviços de confraternização.",
    "promotion_exemption": {
      "name": "5 Participantes Isentos",
      "is_active": false,
      "status": "Aguardando validação jurídica e autorização aplicável",
      "min_guests": 15,
      "exempt_participants": 5
    },
    "event_types_supported": [
      "Confraternização Empresarial",
      "Evento de Fim de Ano",
      "Almoço/Jantar Corporativo"
    ],
    "regulations": "Uso único, individual e intransferível. Validade de 30 dias após emissão."
  }
}
```

---

### 3.2. `POST /api/bpe26/participante`
Cadastra ou atualiza o lead no CRM Alpha Bull a partir do formulário unificado da campanha BPE26.

- **Roteamento Comercial:**
  - **Categoria EVENTO:** Cria/atualiza o cliente na base (`clients`), calcula a prioridade comercial (Alta, Média, Em Nutrição, Outras), cria/atualiza a oportunidade em `event_opportunities` e exibe na coluna **EVENTOS** do Kanban comercial com a faixa prevista de convidados.
  - **Categoria KIT:** Cria/atualiza o contato na base (`clients`), registra o interesse comercial em kits e carnes nobres em suas preferências, vincula à campanha BPE26 e direciona para o fluxo comercial de produtos no Kanban. **Não cria oportunidade de evento**.
- **Promoção / Sorteio:** O sistema de sorteio e atribuição de números da sorte permanece **desativado** até a regularização formal da promoção. A gravação do lead não gera cupom ou sorteio automático nesta etapa.
- **Headers:** `Content-Type: application/json`
- **Campos do Payload:**

| Campo | Tipo | Obrigatório | Descrição / Exemplo |
| :--- | :--- | :--- | :--- |
| `contact_name` ou `full_name` | String | **Sim** | Nome completo do participante (`"Carlos Eduardo Silva"`) |
| `company_name` ou `company` | String | **Sim** | Nome da empresa representada (`"Grupo Empresarial Silva Ltda"`) |
| `contact_phone` ou `whatsapp` | String | **Sim** | Telefone celular com DDD com pelo menos 10 dígitos (`"71988887777"`) |
| `contact_email` ou `email` | String | **Sim** | E-mail corporativo ou pessoal (`"carlos@silva.com.br"`) |
| `category` ou `interest` | String | **Sim** | Categoria de interesse: `'kit'` ou `'evento'` |
| `known_brand` ou `knownAlphaBull` | String | **Sim** | Conhecimento prévio: `'sim'`, `'ja_ouvi'` ou `'nao'` |
| `guests_range` ou `guestCount` | String | **Sim** | Faixa de participantes/convidados exata conforme categoria selecionada |
| `instagram` | String | Não | Perfil do Instagram com ou sem `@` (`"@carlossilva"`) |
| `birth_date` ou `birthDate` | String | Não | Data de nascimento (`"1985-06-20"` ou `"20/06/1985"`) |
| `consent_marketing` | Boolean | Não | Consentimento opcional para novidades e ofertas (default: `false`) |
| `consent_commercial` | Boolean | Não | Aceite dos termos de privacidade e política comercial (default: `true`) |
| `_hp_check` | String | Não | Campo armadilha honeypot anti-bot (deve vir vazio) |

#### Faixas de Participantes Suportadas:
- **Categoria KIT:**
  * `"Até 5 pessoas."`
  * `"6 a 10 pessoas."`
  * `"11 a 15 pessoas."`
  * `"16 a 20 pessoas."`
  * `"Mais de 20 pessoas."`
  * `"Ainda não defini."`
- **Categoria EVENTO:**
  * `"Até 14 pessoas."`
  * `"15 a 25 pessoas."`
  * `"26 a 50 pessoas."`
  * `"51 a 100 pessoas."`
  * `"Mais de 100 pessoas."`
  * `"Ainda não defini."`

- **Exemplo de Payload (Categoria EVENTO):**
```json
{
  "contact_name": "Carlos Eduardo Silva",
  "company_name": "Grupo Empresarial Exemplo Ltda",
  "contact_phone": "71988887777",
  "contact_email": "carlos@empresaexemplo.com.br",
  "category": "evento",
  "guests_range": "26 a 50 pessoas.",
  "known_brand": "sim",
  "instagram": "@carlossilva",
  "birth_date": "1985-06-20",
  "consent_marketing": true,
  "consent_commercial": true,
  "_hp_check": ""
}
```

- **Resposta de Sucesso — Categoria EVENTO (200 OK):**
```json
{
  "success": true,
  "category": "EVENTO",
  "message": "Participante e oportunidade de evento corporativo cadastrados com sucesso!",
  "lead": {
    "client_id": "7a3f81e2-...",
    "opportunity_id": "e82b192a-...",
    "company_name": "Grupo Empresarial Exemplo Ltda",
    "contact_name": "Carlos Eduardo Silva",
    "category": "EVENTO",
    "priority": "ALTA",
    "stage": "novo_lead",
    "guests_range": "26 a 50 pessoas."
  },
  "participant_token": "NzE5ODg4ODc3Nzc6QlBFMjY6MTc5MTg1NzU5..._token_assinado"
}
```

- **Exemplo de Payload (Categoria KIT):**
```json
{
  "contact_name": "Mariana Brito",
  "company_name": "Brito Consultoria",
  "contact_phone": "71999998888",
  "contact_email": "mariana@britoconsultoria.com.br",
  "category": "kit",
  "guests_range": "6 a 10 pessoas.",
  "known_brand": "ja_ouvi",
  "instagram": "@marianabrito",
  "consent_marketing": true,
  "consent_commercial": true,
  "_hp_check": ""
}
```

- **Resposta de Sucesso — Categoria KIT (200 OK):**
```json
{
  "success": true,
  "category": "KIT",
  "message": "Participante cadastrado com sucesso! Interesse em kits de carnes nobres registrado.",
  "lead": {
    "client_id": "5c1f92a3-...",
    "company_name": "Brito Consultoria",
    "contact_name": "Mariana Brito",
    "category": "KIT",
    "guests_range": "6 a 10 pessoas."
  },
  "participant_token": "NzE5OTk5OTg4ODg6QlBFMjY6MTc5MTg1NzU5..._token_assinado"
}
```

- **Respostas de Erro:**
  * `400 Bad Request`: Campos obrigatórios ausentes, telefone inválido, formato de e-mail inválido, ou honeypot acionado.
  * `429 Too Many Requests`: Limite de requisições excedido para o IP (máx. 10/min) ou telefone (máx. 5/min).
  * `500 Internal Server Error`: Erro interno no processamento do lead.

---

### 3.3. `GET /api/bpe26/quiz`
Retorna as 5 perguntas gastronômicas e alternativas do quiz **sem revelar as alternativas corretas**.

- **Resposta (200 OK):**
```json
{
  "success": true,
  "campaign": "BPE26",
  "total_questions": 5,
  "questions": [
    {
      "id": "q1",
      "order_num": 1,
      "question_text": "Qual é a principal característica que define a carne Wagyu e sua alta pontuação de marmoreio (BMS)?",
      "options": [
        { "letter": "A", "option_text": "Coloração avermelhada escura e baixo teor de gordura intramuscular" },
        { "letter": "B", "option_text": "Intenso marmoreio (gordura entremeada) que confere maciez extrema e suculência única" },
        { "letter": "C", "option_text": "Maturação a seco exclusivamente por mais de 90 dias" },
        { "letter": "D", "option_text": "Origem de animais criados apenas com pastagem nativa" }
      ]
    }
  ]
}
```

---

### 3.4. `POST /api/bpe26/quiz/responder`
Submete as respostas do participante. A correção ocorre **exclusivamente no servidor**. Se o participante acertar 2 ou mais questões, um cupom individual de uso único é emitido. Se o participante já possuir cupom emitido, o cupom existente é preservado sem gerar duplicatas.

- **Payload:**
```json
{
  "participant_name": "Carlos Eduardo Silva",
  "participant_phone": "71988887777",
  "participant_email": "carlos@empresaexemplo.com.br",
  "company_name": "Grupo Empresarial Exemplo Ltda",
  "answers": {
    "q1": "B",
    "q2": "A",
    "q3": "B",
    "q4": "B",
    "q5": "B"
  },
  "_hp_check": ""
}
```

- **Resposta (200 OK):**
```json
{
  "success": true,
  "data": {
    "score": 5,
    "total_questions": 5,
    "discount_percent": 20,
    "coupon_code": "BPE26-K9X7W",
    "is_new_coupon": true,
    "message": "Sensacional! Você gabaritou o Quiz Alpha Bull e conquistou o desconto máximo de 20% OFF em cortes nobres!",
    "participant_token": "NzE5ODg4ODc3Nzc6QlBFMjY6MTc5MTg1NzU5..._token_assinado"
  }
}
```

---

### 3.5. `GET /api/bpe26/cupom`
Permite verificar um cupom por código ou recuperá-lo por telefone de forma autenticada.

#### Modo 1: Consulta por Código do Cupom (Validação no Checkout)
- **Chamada:** `GET /api/bpe26/cupom?code=BPE26-K9X7W`
- **Resposta (200 OK):**
```json
{
  "success": true,
  "data": {
    "code": "BPE26-K9X7W",
    "discount_percent": 20,
    "status": "ATIVO",
    "expires_at": "2026-11-09T20:45:00.000Z",
    "restrictions": "Válido exclusivamente para compras de produtos elegíveis da Alpha Bull (cortes nobres). Não cumulativo com outras promoções. Uso único por participante."
  }
}
```

#### Modo 2: Recuperação de Cupom por Telefone (Exige Token do Participante)
- **Chamada:** `GET /api/bpe26/cupom?phone=71988887777&token=<participant_token>`
  *(Ou envie no header `Authorization: Bearer <participant_token>`)*
- **Resposta sem token (401 Unauthorized):**
```json
{
  "error": "Acesso restrito. Para consultar cupom por telefone, é obrigatório fornecer o token de verificação emitido ao concluir o quiz, ou consulte diretamente pelo código do cupom.",
  "requires_auth": true
}
```
- **Resposta com token válido (200 OK):**
```json
{
  "success": true,
  "data": {
    "code": "BPE26-K9X7W",
    "discount_percent": 20,
    "status": "ATIVO",
    "expires_at": "2026-11-09T20:45:00.000Z",
    "restrictions": "Válido exclusivamente para compras de produtos elegíveis da Alpha Bull (cortes nobres)."
  }
}
```

---

### 3.6. `POST /api/bpe26/solicitar-orcamento`
Registra que o visitante clicou no botão "Solicitar Orçamento" na landing page, movendo o status comercial no Kanban para `Orçamento Solicitado`.

- **Payload:**
```json
{
  "phone": "71988887777"
}
```
- **Resposta (200 OK):**
```json
{
  "success": true,
  "message": "Solicitação de orçamento registrada com sucesso no CRM Alpha Bull!"
}
```

---

## 4. Exemplo de Integração Frontend (Next.js / React / Fetch)

Exemplo compatível com o formulário oficial em `app/bpe26/Bpe26Form.jsx`:

```javascript
// Configuração da URL da API do CRM (definir em .env.local: NEXT_PUBLIC_CRM_API_URL=https://crm.alphabull.com.br)
const CRM_API_BASE = process.env.NEXT_PUBLIC_CRM_API_URL || 'https://crm.alphabull.com.br';

/**
 * Envia o cadastro do participante da campanha BPE26 para o CRM
 * @param {Object} formData Dados coletados no formulário
 */
export async function cadastrarLeadBPE26(formData) {
  try {
    const payload = {
      contact_name: formData.fullName?.trim(),
      company_name: formData.company?.trim(),
      contact_phone: formData.phone?.replace(/\D/g, ''),
      contact_email: formData.email?.trim().toLowerCase(),
      category: formData.interest, // 'kit' ou 'evento'
      guests_range: formData.guestCount, // Ex: '6 a 10 pessoas.' ou '26 a 50 pessoas.'
      known_brand: formData.knownAlphaBull, // 'sim', 'ja_ouvi' ou 'nao'
      instagram: formData.instagram ? formData.instagram.trim() : null,
      birth_date: formData.birthDate || null,
      consent_marketing: Boolean(formData.acceptMarketing),
      consent_commercial: Boolean(formData.acceptPrivacy),
      _hp_check: '' // Proteção honeypot anti-bot
    };

    const response = await fetch(`${CRM_API_BASE}/api/bpe26/participante`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao processar cadastro no CRM.');
    }

    // Token do participante retornado para eventuais consultas seguras subsequentes
    if (data.participant_token) {
      sessionStorage.setItem('alphabull_bpe26_token', data.participant_token);
    }

    return {
      success: true,
      category: data.category,
      message: data.message,
      lead: data.lead
    };
  } catch (error) {
    console.error('Falha na integração com o CRM:', error);
    return {
      success: false,
      error: error.message || 'Falha de comunicação com o servidor.'
    };
  }
}
```

---

## 5. Integração com o Tablet do Estande (`https://churrascosalvador.com/bpe26/quiz`)

O tablet no estande da Alpha Bull executará o **Desafio Alpha Bull** em 5 etapas contínuas:

1. **Identificação do Visitante:** O tablet envia `POST /api/bpe26/participante` com `origin_channel: 'BPE26_QUIZ_STAND'`. Se o visitante já tiver se cadastrado anteriormente pelo QR Code, o CRM reaproveita o cadastro sem duplicar o cliente.
2. **Carregamento das Perguntas:** O tablet consulta `GET /api/bpe26/quiz` e recebe as **5 perguntas da versão publicada**, sem gabarito.
3. **Respostas no Tablet:** O visitante responde às 5 perguntas de múltipla escolha.
4. **Correção e Conquista de Benefício:** O tablet submete `POST /api/bpe26/quiz/responder` com as respostas `{ q1: 'B', ... }`. O servidor corrige, calcula o desconto (0%, 5%, 8%, 15% ou 20%) e emite um cupom exclusivo no padrão `BPE26-XXXXX` para participantes com 2 ou mais acertos.
5. **Finalização Segura no Tablet:** O tablet exibe o resultado final e o código do cupom, limpando a sessão local ao clicar em "Novo Participante" para não expor dados ao próximo visitante.

### Exemplo de Submissão do Quiz no Tablet:
```javascript
export async function submeterQuizEstande({ participantName, phone, email, company, answers }) {
  const response = await fetch(`${CRM_API_BASE}/api/bpe26/quiz/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_name: participantName,
      participant_phone: phone.replace(/\D/g, ''),
      participant_email: email,
      company_name: company,
      origin_channel: 'BPE26_QUIZ_STAND',
      answers, // { [question_id]: 'A' | 'B' | 'C' | 'D' }
      _hp_check: ''
    })
  });

  const res = await response.json();
  if (!response.ok) throw new Error(res.error || 'Erro ao submeter quiz');
  return res.data;
  // Retorna: { score: 4, total_questions: 5, discount_percent: 15, coupon_code: 'BPE26-XXXXX', message: '...' }
}
```

---

## 6. Endpoints Administrativos do CRM Alpha Bull

Os endpoints abaixo são restritos a administradores autenticados com sessão ativa no CRM:

- `GET /api/bpe26/admin/quiz/perguntas?campaign=BPE26`: Lista todas as perguntas cadastradas no banco com opções e resposta correta.
- `POST /api/bpe26/admin/quiz/perguntas`: Cria ou edita pergunta com enunciado, 4 opções e seleção da resposta correta.
- `POST /api/bpe26/admin/quiz/publicar`: Publica uma nova versão do quiz com exatamente 5 perguntas selecionadas.
- `GET /api/bpe26/admin/quiz/resultado-lead?phone={numero}`: Retorna a submissão, respostas, pontuação e cupom emitido para um lead específico (consumido pelo modal de gerenciamento).

