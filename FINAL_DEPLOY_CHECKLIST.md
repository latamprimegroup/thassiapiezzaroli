# FINAL DEPLOY CHECKLIST — WAR ROOM OS + OFFERS LAB

## 1) Auditoria de Rotas, Segurança e Resiliência

### ✅ Concluído nesta etapa
- Endpoints do Offers Lab revisados e endurecidos:
  - `GET/POST /api/offers-lab`
  - `POST /api/offers-lab/callback`
  - `GET/POST /api/offers-lab/sync`
- Callback de eventos com:
  - rate limit por IP (janela de 1 min)
  - limite de payload (`callbackMaxPayloadBytes`)
  - ingestão em lote (`events[]`) para throughput elevado
  - suporte a payload único e lote no mesmo endpoint
- Webhook central (`/api/webhooks/warroom`) com:
  - rate limit defensivo
  - tratamento robusto de erro + observabilidade
- Middleware global de segurança adicionado:
  - `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
  - `Cache-Control: no-store` para rotas `/api/*`

### ⚠️ Pendência de produção (infra)
- WAF/CDN (Cloudflare/AWS) com regras anti-abuso e IP reputation.
- Limiter distribuído (Redis) para ambientes com múltiplas instâncias.

---

## 2) Backlog OFFERS LAB (UTMs + Regra dos 70k)

### ✅ Concluído nesta etapa
- Parser UTM reforçado para normalização de canais:
  - Meta, Google, TikTok, Kwai e Networking
  - fallback por sinais (`fbclid`, `gclid`, `ttclid`) quando `utm_source` vier sujo
- Extração e padronização de `Nome|ID`:
  - `utm_campaign`, `utm_content`, `utm_term`
- Regra de validação 7D implementada e auditada:
  - `SUM(revenue) >= 70000` e `ROAS >= 1.8`
  - promoção automática para status de validação/escala
  - marcação automática de `Candidata a Lançamento` para networking
- `utm_brought_by` obrigatório:
  - validação na aplicação (offers e traffic events)
  - constraint de banco adicionada (modo `NOT VALID` para migração segura)

### ⚠️ Pendência de produção (governança de dado)
- Rodar rotina de saneamento para registros antigos sem `utm_brought_by` em networking e depois validar constraints.

---

## 3) UX/UI “Sistema Desejável”

### ✅ Concluído nesta etapa
- Offers Lab com visual dark de alta densidade já integrado ao cockpit.
- Skeleton screens aplicados no módulo para carga inicial sem “tela vazia”.
- Checklist de UTM para Copywriter mantido como gate de cadastro.
- Melhorias de carregamento:
  - split de bundle via `dynamic import` no módulo Offers Lab.

### ⚠️ Pendência de produção (UX)
- Teste visual em breakpoints extremos (320px e 4K TV wall).
- QA manual final de consistência de espaçamentos/tipografia por squad.

---

## 4) Production Readiness (Deploy)

### ✅ Concluído nesta etapa
- Cache inteligente no dashboard do Offers Lab com TTL (`offersLab.cacheTtlSeconds`).
- Ingestão em lote para reduzir round-trips e custo de IO.
- Instrumentação de erro silencioso:
  - storage local de erros (`.war-room/error-monitoring.json`)
  - endpoint de ingestão/listagem: `POST/GET /api/ops/errors`
  - forward opcional para webhook (`ERROR_MONITOR_WEBHOOK_URL`)
- Variáveis de ambiente ampliadas em `.env.example`.

### ⚠️ Pendência de produção (obrigatório antes de go-live)
- Configurar:
  - `DATABASE_URL` + `WAR_ROOM_OPS_PERSISTENCE_MODE=database`
  - `OFFERS_LAB_API_KEY`, `WAR_ROOM_WEBHOOK_API_KEY`
  - `UTMIFY_SYNC_URL`/`UTMIFY_API_KEY`
  - `ERROR_MONITOR_WEBHOOK_URL` (Sentry bridge/webhook interno)
- Scheduler externo:
  - chamar `POST /api/offers-lab/sync` a cada 15 min com API key.
- Backup/restore validado para tabelas `offers_lab_*`.

---

## 5) Testes e Verificação de Saúde

### ✅ Rodado nesta etapa
- `npm run lint` ✅
- `npm run build` ✅

### ⚠️ Recomendado para homologação final
- Teste de carga dedicado para Offers Lab callback:
  - cenário de pico > 50k eventos/dia com payload em lote.
- Teste de caos:
  - indisponibilidade temporária do UTMify
  - reprocessamento após retorno
  - validação de consistência de `revenue7d`/`roas7d`.

---

## 6) Go/No-Go para Push em Produção

### Go, se:
- Variáveis críticas preenchidas.
- Scheduler de sync ativo.
- Banco em modo `database`.
- Monitoramento de erro configurado.

### No-Go, se:
- Operando sem autenticação forte de webhook/callback.
- Sem rotina de backup/restore.
- Sem validação de carga no volume esperado.

