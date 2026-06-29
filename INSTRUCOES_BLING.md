# Como Obter as Credenciais do Bling (API v3)

Para que o CRM consiga ler vendas e atualizar o LTV dos seus clientes automaticamente, precisamos criar um "Aplicativo Privado" na sua conta do Bling. É um processo rápido de 3 minutos.

## 1. Acesse o Painel de Desenvolvedores
1. Entre na sua conta do Bling (como Administrador).
2. Vá em **Preferências** (engrenagem) > **Sistemas** > **Aplicativos e Integrações**.
3. Clique em **Criar Aplicativo**.

## 2. Preencha os Dados do Aplicativo
- **Nome:** `CRM Inteligente Alpha Bull`
- **URL de Retorno (Callback):** 
  Coloque exatamente assim: `http://localhost:3000/api/auth/bling/callback` 
  *(Nota: quando colocarmos no ar, trocaremos o localhost pelo domínio real, como crm.alphabull.com.br).*

## 3. Selecione as Permissões (Escopos)
Marque as caixinhas que darão poder para o nosso CRM agir. Precisamos de:
- `Clientes e Fornecedores` (Para ler nome, telefone e LTV).
- `Pedidos de Venda` (Para ler o histórico de compras e somar o Cashback).
- `Webhooks` (Para o Bling avisar o CRM em tempo real quando uma venda for feita).

## 4. Guarde as Chaves
Após salvar, o Bling vai gerar duas chaves muito importantes:
- `Client ID`
- `Client Secret`

Guarde essas duas chaves com você. Logo nós vamos criar um arquivo chamado `.env` no projeto e colocar elas lá para a mágica acontecer!
