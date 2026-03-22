# DEPLOY READY - WAR ROOM OS (Vercel)

Status geral: **APROVADO PARA PRODUCAO** (codigo/build/tipos validados).  
Condicao obrigatoria: variaveis de ambiente de producao configuradas corretamente na Vercel.

## 1) Auditoria de Build e TypeScript

Executado com sucesso:

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Resultado: sem erros de lint, sem erros de TypeScript e build de producao concluido.

## 2) Seguranca e .env

Blindagens aplicadas:

- Remocao de fallback inseguro em producao para fluxos sensiveis (fail-closed).
- `WAR_ROOM_SESSION_SECRET` validado como forte em producao.
- Hardening de go-live permanece ativo por padrao.
- Chaves sensiveis mantidas via `process.env`.
- `.env.example` atualizado com:
  - `WAR_ROOM_ALLOWED_ORIGINS`
  - `WAR_ROOM_OFFERS_DASHBOARD_EVENTS_LIMIT`
  - `WAR_ROOM_ENABLE_DEMO_SWITCH_USER`
  - requisitos de hardening/Redis/DB/HMAC.

## 3) CORS, CSRF e Origem Confiavel

Implementado no `src/proxy.ts`:

- Controle de origem para rotas API mutaveis.
- Bloqueio de requests mutaveis de origem nao confiavel em producao.
- Allowlist de origens:
  - origem atual do request,
  - `NEXT_PUBLIC_APP_URL`,
  - `WAR_ROOM_ALLOWED_ORIGINS` (lista CSV).
- Preflight `OPTIONS` com resposta controlada.
- Webhooks/callbacks mantidos com excecao de origem e protegidos por API key/HMAC.

## 4) Resiliencia de API e Webhooks

Aplicado:

- Validacao de schema com **Zod** em entradas criticas:
  - `/api/offers-lab/callback`
  - `/api/webhooks/warroom`
- Limite de payload e tratamento robusto para JSON malformado.
- Try/catch e log de erro mantidos nas rotas de ingestao.
- Rotas sensiveis adicionais reforcadas (ex.: `/api/command-center/tasks` com autenticacao no GET).

## 5) Performance (UX/UI)

Aplicado:

- Lazy loading adicional de modulos pesados no `Dashboard` (carregamento sob demanda por secao).
- Skeletons de carregamento para manter FCP perceptivelmente rapido.
- Mantido estilo dark/high-density nos modulos.

## 6) Banco de Dados e Serverless (Vercel)

Aplicado:

- Conexao de banco para `source-db` migrada para **pool global reutilizavel** (serverless-friendly).
- Sem abertura/fechamento de pool a cada request no caminho principal de leitura.
- Otimizacao para regra de 70k:
  - dashboard passou a ler eventos de 7 dias filtrando `eventType = sale`,
  - limite configuravel por env (`WAR_ROOM_OFFERS_DASHBOARD_EVENTS_LIMIT`),
  - indice SQL adicional para `event_type + occurred_at`.

## 7) Arquivos de Deploy

Gerado:

- `vercel.json` com configuracao base de producao (framework, regiao e maxDuration API).

## 8) Checklist final para Vercel (obrigatorio antes do Go Live)

Configure no projeto Vercel:

- `DATABASE_URL`
- `DATABASE_SSL`
- `REDIS_URL` (quando `WAR_ROOM_REQUIRE_REDIS_IN_PROD=true`)
- `WAR_ROOM_SESSION_SECRET` (forte)
- `WAR_ROOM_WEBHOOK_API_KEY`
- `OFFERS_LAB_API_KEY`
- `UTMIFY_WEBHOOK_SECRET`
- `APPMAX_WEBHOOK_SECRET`
- `KIWIFY_WEBHOOK_SECRET`
- `YAMPI_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `WAR_ROOM_ALLOWED_ORIGINS`

Recomendacao de validacao pos-deploy:

1. `GET /api/health?verbose=true` com credencial autorizada.
2. `GET /api/ops/go-live` (roles autorizadas).
3. teste de webhook real com assinatura HMAC valida.
4. smoke test de login/session + rotas de POST internas no dominio oficial.

---

Conclusao: **codigo pronto para deploy na Vercel com padrao enterprise de seguranca e resiliencia**.  
Com as variaveis acima configuradas, o WAR ROOM OS esta apto para subir em producao.
