# WAR ROOM OS - Proxima Etapa Tecnica (Implementation Spec 9D)

Este documento define a proxima etapa tecnica para evolucao controlada do ERP.

Escopo:
- padronizar contratos entre modulos;
- guiar implementacao sem regressao;
- orientar QA e validacao de producao.

---

## 1) Arquitetura alvo (alto nivel)

```
[External Providers]
  Utmify | Appmax | Kiwify | Yampi
        |
        v
[Webhook/API Layer]
        |
        v
[Ops Queue + Worker]
        |
        v
[Operational Persistence]
  file (fallback) | database (postgres)
        |
        v
[Integration Merge Engine]
        |
        v
[WAR ROOM API]
        |
        v
[Dashboard Modules + RBAC + Incident Center]
```

---

## 2) Contratos de dados (resumo)

## 2.1 Ops Jobs
Campos obrigatorios:
- id, type, status, attempts, maxAttempts
- runAt, createdAt, updatedAt, processedAt
- lastError, payload

Estados:
- pending -> processing -> completed
- pending/processing -> dead_letter

## 2.2 Ops Incidents
Campos obrigatorios:
- id, key, squad, severity, status
- title, description, source
- startedAt, lastSeenAt, resolvedAt
- slaTargetMinutes, slaBreached
- resolutionMinutes, resolutionNote, resolvedBy

Estados:
- open -> resolved

## 2.3 SLO Snapshot
Campos obrigatorios:
- queue.depth, queue.failedJobs, queue.processedToday
- reliability.errorRatePct, reliability.estimatedMttrMinutes
- slos[] com status pass|warning|breach
- incidentCenter (open/resolved/breached/mttrBySquad/recent)

---

## 3) APIs de operacao

## 3.1 Ops Worker
- `GET /api/ops/worker`
- `POST /api/ops/worker` (`limit`)
- `HEAD /api/ops/worker` (headers de fila)

## 3.2 Observability
- `GET /api/ops/observability`
  - retorna snapshot consolidado de SLO + incident center.

## 3.3 Incidents
- `GET /api/ops/incidents`
  - lista + metricas historicas.
- `POST /api/ops/incidents`
  - resolve incidente manualmente.
  - autorizado para `ceo` e `mediaBuyer`.

---

## 4) Regras de autorizacao

Padrao:
- API key (`WAR_ROOM_WEBHOOK_API_KEY`) para automacao;
- sessao web para uso via UI;
- role-based para acoes sensiveis.

Regras:
- leitura operacional: qualquer sessao valida (ou API key).
- resolucao manual de incidente: somente CEO / Media Buyer.

---

## 5) Persistencia operacional (modes)

## 5.1 file mode (fallback)
`WAR_ROOM_OPS_PERSISTENCE_MODE=file`

Uso:
- dev local
- ambiente de baixo risco

## 5.2 database mode (producao)
`WAR_ROOM_OPS_PERSISTENCE_MODE=database`

Dependencias:
- `DATABASE_URL`
- `DATABASE_SSL` conforme ambiente

Beneficios:
- lock distribuido para fila
- historico transacional
- multi-worker seguro

Schema:
- `docs/sql/war_room_ops_schema.sql`

---

## 6) Fluxos criticos (sequencia)

## 6.1 Webhook ingest
1. endpoint recebe payload.
2. autentica + identifica provider.
3. enfileira job `webhook_ingest`.
4. worker processa, normaliza, persiste status.
5. erro -> retry/backoff -> dead_letter.

## 6.2 SLO -> Incidente
1. observability calcula snapshot.
2. se SLO warning/breach, abre/atualiza incidente.
3. se SLO volta a pass, resolve incidente automaticamente.
4. incidente manual pode ser resolvido via painel.

## 6.3 Command Center approvals
1. tarefa de edicao exige gate.
2. aprovador autorizado executa approval API.
3. approval persistido + trilha auditavel.

---

## 7) Cenarios de teste (QA)

## 7.1 Funcional
- [ ] webhook valido entra em fila e completa.
- [ ] webhook invalido gera rejected/dead_letter.
- [ ] incidentes sao abertos e resolvidos automaticamente por SLO.
- [ ] resolucao manual de incidente funciona com role permitido.
- [ ] gate de done bloqueia sem aprovacao.

## 7.2 RBAC/Security
- [ ] editor nao resolve incidente.
- [ ] rota de ops sem sessao/api-key retorna 401.
- [ ] dados sensiveis seguem sanitizacao por role.

## 7.3 Performance
- [ ] stress de 50k eventos conclui sem perda significativa.
- [ ] queue drain dentro do alvo em carga nominal.
- [ ] dashboard segue responsivo durante ingestao.

---

## 8) Stress test operacional (script)

Comando:

```bash
STRESS_BASE_URL=http://localhost:3000 \
STRESS_EVENTS=50000 \
STRESS_CONCURRENCY=50 \
STRESS_API_KEY=seu_token \
npm run stress:webhooks
```

Saidas esperadas:
- throughput consistente;
- taxa de sucesso alta;
- backlog drenando dentro do SLO;
- baixa incidencia de dead-letter.

---

## 9) Definicao de pronto (DoD) da proxima etapa

- [ ] sem erros de lint/build
- [ ] regressao de APIs inexistente
- [ ] RBAC validado em rotas de operacao
- [ ] stress test executado com evidencias registradas
- [ ] documentacao atualizada (exec + tech + runbook)

---

## 10) Runbook minimo de incidente (operacao)

Quando SIREN ON:
1. identificar causa dominante (MER, checkout, approval, pixel, domain).
2. abrir/confirmar incidente no Incident Center.
3. definir owner e ETA de mitigacao.
4. executar rollback/contingencia conforme modulo.
5. validar retorno para estado pass.
6. registrar resolucao e causa-raiz.

Tempo alvo:
- critico: acao inicial em ate 3 minutos.
- warning: acao inicial em ate 10 minutos.
