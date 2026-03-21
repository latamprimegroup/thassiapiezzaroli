# GO LIVE RUNBOOK 10D - WAR ROOM OS

## 1) Pre-flight tecnico (obrigatorio)

1. Configurar ambiente de producao:
   - `WAR_ROOM_OPS_PERSISTENCE_MODE=database`
   - `DATABASE_URL`
   - `REDIS_URL`
   - `WAR_ROOM_WEBHOOK_API_KEY`
   - `OFFERS_LAB_API_KEY`
   - `UTMIFY_WEBHOOK_SECRET`, `APPMAX_WEBHOOK_SECRET`, `KIWIFY_WEBHOOK_SECRET`, `YAMPI_WEBHOOK_SECRET`
   - `ERROR_MONITOR_WEBHOOK_URL` (ou `SENTRY_WEBHOOK_URL`)
2. Hardening flags:
   - `WAR_ROOM_REQUIRE_DATABASE_IN_PROD=true`
   - `WAR_ROOM_REQUIRE_REDIS_IN_PROD=true`
   - `WAR_ROOM_REQUIRE_HMAC_IN_PROD=true`
   - `WAR_ROOM_MIN_SECRET_LENGTH=24`
3. Opcional para bloqueio automatico de deploy inseguro:
   - `WAR_ROOM_ENFORCE_PROD_HARDENING=true`

## 2) Validacao go/no-go

- Endpoint: `GET /api/ops/go-live`
- Resultado:
  - `snapshot.goNoGo = true` -> apto para go-live
  - `snapshot.goNoGo = false` -> corrigir `snapshot.blockingFailures`

## 3) Health checks

- `GET /api/health`
- `GET /api/health?verbose=true`
- `GET /api/ops/observability`

## 4) Backup e evidencia operacional

1. Realizar backup completo do Postgres (`pg_dump`).
2. Realizar teste de restore em ambiente de homologacao.
3. Atualizar `WAR_ROOM_BACKUP_LAST_SUCCESS_AT` com timestamp ISO da ultima evidencia valida.

## 5) Canary release recomendado

1. Subir versao com 10-20% de trafego interno.
2. Monitorar por no minimo 60 minutos:
   - erro por rota
   - latencia p95
   - fila/DLQ
   - status de integracoes
3. Expandir para 50% e depois 100%.

## 6) Rollback rapido

1. Reverter para release anterior.
2. Garantir `WAR_ROOM_ENFORCE_PROD_HARDENING=false` em emergencia, somente durante rollback.
3. Reprocessar eventos pendentes:
   - `GET /api/webhooks/warroom`

