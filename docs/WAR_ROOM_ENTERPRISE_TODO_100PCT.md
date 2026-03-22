# WAR ROOM OS - Backlog Tecnico para 100% Enterprise

## Objetivo
Fechar os gaps finais de escala, observabilidade e governanca para operacao de DR em padrao global.

## Prioridade P0 (fundacao de escala)
- [ ] Migrar `ops-store` de arquivo para Postgres/Supabase com migracoes versionadas.
- [ ] Substituir fila local por fila distribuida (Redis Streams/SQS/Kafka).
- [ ] Isolar worker fleet por dominio:
  - [ ] webhook_ingest
  - [ ] reconciliation
  - [ ] alerts_dispatch
- [ ] Implementar snapshot cache para cards do CEO (TTL 15-30s + invalidacao em eventos criticos).
- [ ] Expor metricas operacionais em endpoint de observabilidade:
  - [ ] queue depth
  - [ ] DLQ rate
  - [ ] webhook ingest p95
  - [ ] merge runtime p95

## Prioridade P1 (governanca de atribuicao e copy)
- [ ] Criar `creative_aliases` com trilha de aprovacao (quem aprovou, quando, motivo).
- [ ] Implementar reconciliacao canonica de naming no backend antes do merge de KPI.
- [ ] Bloquear export para Meta quando naming invalido ou sem mapping aprovado.
- [ ] Versionar Big Ideas (v1/v2/v3) com status: draft/review/approved/archived.
- [ ] Retroalimentar score da Ficha de Desconstrucao com:
  - [ ] CPA real 7d
  - [ ] ROAS real 7d
  - [ ] Trend de Hook/Hold

## Prioridade P2 (predicao e decisao automatica)
- [ ] Feature store para LTV (D1-D7 features de Appmax/Kiwify/Utmify).
- [ ] Pipeline de treino diario para LTV90 (baseline + modelo supervisionado).
- [ ] Motor de experimentacao estatistica:
  - [ ] alpha/power/MDE configuraveis
  - [ ] stop rules
  - [ ] winner auto-decision
- [ ] Incident Center com SLA/MTTR por squad e custo de oportunidade por incidente.
- [ ] Relatorio executivo diario com benchmark por mecanismo e por angulo.

## Definicao de pronto (DoD) por modulo
- [ ] Cobertura de testes minima definida e aplicada.
- [ ] Alertas operacionais com dedupe e escalonamento.
- [ ] Auditoria de permissao (RBAC) validada em rota + payload.
- [ ] Telemetria publicada e monitorada (SLO/erro budget).
