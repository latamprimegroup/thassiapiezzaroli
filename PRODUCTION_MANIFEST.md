# PRODUCTION MANIFEST - WAR ROOM OS (9-FIGURES READINESS)

Data: 2026-03-20  
Branch: `cursor/war-room-dashboard-230c`

## 1) Build e Runtime (Vercel Ready)

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

### Hardening aplicado

- Proteção global de requests ativa via `src/proxy.ts` (runtime Next 16).
- Endpoints operacionais `ops/*` com RBAC explícito:
  - `ops/worker`: CEO + Tech Admin/CTO
  - `ops/observability`: CEO + Financeiro + Tech Admin/CTO
  - `ops/incidents` (GET): CEO + Financeiro + Tech Admin/CTO
- `isOpsAuthorized` agora fail-closed por padrão quando `allowedRoles` não é informado.
- `POST /api/ops/errors` protegido (sessão ou API key) + rate limit por IP.
- `GET /api/war-room` fechado em produção para anônimos.
- `GET /api/routing/resolve` exige sessão/API key em produção.

## 2) Sessão / Auth

### Ajuste crítico

- Leitura de claims Supabase por cookie agora é controlada por flag:
  - `WAR_ROOM_TRUST_SUPABASE_JWT_CLAIMS`
  - Default recomendado em produção: `false`

> Motivo: evitar confiar em claims JWT sem validação criptográfica de assinatura no backend.

## 3) Banco, Query e Integridade de Dados

### Integridade financeira / concorrência

- Criada operação atômica para recuperação de vendas via CRM:
  - `incrementDailySettlementSale(...)`
  - Implementação em `store` e `db`
  - Em PostgreSQL usa transação + lock (`FOR UPDATE`) para evitar perda/duplicidade por corrida de webhooks.

### Precisão monetária

- Introduzido helper de dinheiro por centavos:
  - `src/lib/metrics/money.ts`
- `calculateEstimatedNetProfit` atualizado para operar com rounding determinístico de centavos.

### Query policy

- Mantido foco em correções de segurança e consistência financeira nesta iteração.
- Recomenda-se continuar redução progressiva de `SELECT *` em tabelas de alto volume como política contínua.

## 4) Timezone de negócio (70k/7D e relatórios)

### Padronização aplicada

- Introduzido relógio de negócio:
  - `src/lib/time/war-room-clock.ts`
- `dayRangeFromToday` e `toDateOnlyIso` agora respeitam timezone de negócio.
- Janela do Offers Lab 7D agora inicia por dia de negócio, evitando drift de UTC puro.

### Variáveis novas

- `WAR_ROOM_BUSINESS_TIMEZONE=America/Sao_Paulo`
- `WAR_ROOM_BUSINESS_UTC_OFFSET_HOURS=-3`

## 5) Sniper CRM Resilience

- Webhook de primeiro contato:
  - `POST /api/sniper-crm/webhook/contacted`
  - Com rate limiting
- Status automático de contato confirmado (`contacted`, `firstContactAt`) e trilha de auditoria.
- Simulação humana reforçada no primeiro outbound:
  - evento `composing`/`recording`
  - typing speed + delay randômico

## 6) Error Containment

- Global Error Boundary criado:
  - `src/app/error.tsx`
- Falhas de uma área ficam isoladas sem derrubar o restante da experiência.

## 7) Logs e Auditoria

- Ações críticas no CRM registradas com `user_id`, `role`, `timestamp` e evento:
  - first contact webhook
  - stage change
  - sale registered
  - automation pause/resume

## 8) Checklist Operacional de Deploy

### Variáveis de ambiente

- [ ] Produção com segredos diferentes de staging/local.
- [ ] `WAR_ROOM_TRUST_SUPABASE_JWT_CLAIMS=false` em produção.
- [ ] `WAR_ROOM_SESSION_SECRET` forte e único.
- [ ] `WAR_ROOM_ENFORCE_PROD_HARDENING=true`.
- [ ] `WAR_ROOM_REQUIRE_DATABASE_IN_PROD=true`.
- [ ] `WAR_ROOM_REQUIRE_REDIS_IN_PROD=true`.

### Rate limiting

- [x] Webhook central protegido com rate limit.
- [x] Webhook Sniper CRM (`contacted`) protegido com rate limit.
- [x] Ops errors POST protegido com rate limit.

### Backup / recuperação

- [ ] Supabase com Point-in-Time Recovery (PITR) ativo.
- [ ] Evidência de último backup restaurável registrada em runbook.

## 9) Veredito

Status: **READY WITH GUARDRAILS** ✅  

O sistema está apto para produção com hardening adicional já aplicado nesta rodada.  
Para nível “impenetrável” contínuo, próximos passos recomendados:

1. Validação criptográfica formal de JWT Supabase no backend (JWKS).  
2. Cobertura de testes automatizados de concorrência para fluxo de lucro/settlement.  
3. Política contínua de eliminação de `SELECT *` nas consultas mais quentes.  

