# WAR ROOM OS - Auditoria Senior (Padrao Agora Inc.)

## 1) Auditoria de Escala (Stress Test 50.000 eventos/dia)

### Capacidade atual
- A arquitetura atual suporta volume moderado, mas **nao e ideal para 50k eventos/dia com baixa latencia** porque:
  - ingestao de webhooks e retries rodam no ciclo de request (sem worker dedicado);
  - merge de dados e enrichments sao feitos em memoria no processo Node;
  - persistencia operacional usa arquivo local (`.war-room/ops-store.json`), limitado para concorrencia alta;
  - dashboard faz polling periodico e renderiza blocos densos no client.

### Gargalos principais
1. **I/O de arquivo local** na camada de ops store sob carga concorrente.
2. **Processamento sincrono de retries** no request path.
3. **Ausencia de fila distribuida** para webhook/eventos.
4. **Falta de cache de leitura** para cards executivos.
5. **Agregacoes em runtime** sem materializacao (picos de CPU no server).

### Recomendacao imediata
- Migrar eventos para fila + worker (Redis Streams/SQS + consumer).
- Materializar snapshots do dashboard (cada 15-60s) e servir leitura cacheada.
- Persistencia em banco (Postgres/Supabase) para eventos, naming e auditoria.

---

## 2) Gap Analysis vs Agora Inc.

### Pontos fortes ja implementados
- Big Idea Vault + Ficha de Desconstrucao + Score de validacao.
- Nomenclatura universal com regex e builder.
- Fortress (Safe Browsing, Meta debugger, Cloudflare DoH, sirene global).
- Command Center com automacoes intersetoriais.

### Gaps de maturidade
1. **Loop fechado Copy <-> Media ainda parcial**: feedback de CPA/ROAS nao recalcula score da ficha automaticamente por janela temporal.
2. **Versionamento de Big Idea** ainda em estado local (sem trilha de revisao por versao em banco).
3. **Atribuicao resiliente a erro humano** ainda depende de mapeamento local e heuristica simples (drift alert), sem reconciliacao server-side com auto-correcoes persistidas.

---

## 3) Engenharia Avancada

### AI Predictive (LTV 90d)
- Implementado baseline inicial em constants e merge:
  - projecao LTV90 baseada em sinais de 7d, aprovacao Appmax, upsell, share CRM, saude pixel e abandono.
- Proximo nivel:
  1. armazenar features por cohort diario;
  2. treinar regressao simples (XGBoost/LightGBM) offline;
  3. publicar score por cohort em tabela `ltv_predictions`.

### Nomenclatura e atribuicao
- Regex valida geracao local.
- Drift guard detecta typo e criativo sem mapeamento.
- Proximo nivel:
  - reconciliacao server-side com dicionario canonico;
  - fluxo de aprovacao de correcoes de mapping;
  - bloqueio de deploy de campanha sem DNA valido.

---

## 4) Seguranca e Contingencia (The Vault)

### Estado atual
- Dominio monitorado por Safe Browsing + Meta + Cloudflare DoH.
- Siren com triggers por MER, dominio bloqueado, Pixel unhealthy e queda Appmax.
- Push webhook opcional para transicao de estado (`WAR_ROOM_PUSH_ALERT_WEBHOOK`).

### Reforco recomendado
- Assinatura HMAC nos push alerts internos.
- Dedupe de alertas por chave de incidente.
- Escalonamento por severidade (Slack -> WhatsApp -> Pager).

---

## 5) Veredito Final

**Veredito:** robusto para operacao agressiva, mas ainda em transicao para classe global.

### 3 funcionalidades Killer para fechar maturidade
1. **Event Bus + Worker Fleet** para ingestao, retries e enrichments desacoplados.
2. **Attribution Reconciliation Engine** com auto-correcao assistida e trilha auditavel.
3. **Opportunity Lost Engine** (impacto financeiro por incidente em tempo real).

---

## To-Do Tecnico (proximos modulos)

### P0
- [ ] Migrar ops-store para Postgres (eventos, approvals, naming_registry, drift_alerts).
- [ ] Introduzir fila (Redis/SQS) para webhooks e retries assinc.
- [ ] Snapshot cache para dashboard executivo (TTL 15-30s).

### P1
- [ ] Reconciliacao de nomenclatura server-side com tabela de aliases.
- [ ] Auto-score da ficha de copy retroalimentado por CPA/ROAS por janela (7d/14d).
- [ ] Opportunity Lost Report (valor perdido por indisponibilidade de checkout/approval drop).

### P2
- [ ] Modelo ML supervisionado para LTV90 real (treino offline + serving online).
- [ ] Alert routing multi-canal com dedupe e escalonamento.
- [ ] Export executivo diario com benchmark de mecanismo (Agora style).
